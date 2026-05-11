from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from django.contrib.auth.models import User
from django.utils import timezone
from backend.catalog.services.delivery_geo import (
    DeliveryValidationError,
    geocode_address,
    validate_delivery_address,
)
from backend.login.models import UserProfile
from backend.login.utils import get_user_profile
from .models import (
    Category,
    DeliveryCoverageSettings,
    Product,
    Order,
    OrderItem,
    OrderAvailabilityConfig,
    RestrictedDate,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "image")


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "price",
            "image",
            "is_featured",
            "category",
        )


class ProductAdminSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=Category.objects.all(),
        write_only=True,
    )
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "price",
            "image",
            "is_featured",
            "is_active",
            "category",
            "category_id",
        )


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        source="product",
        queryset=Product.objects.all(),
        write_only=True,
    )
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "product_id",
            "quantity",
            "unit_price",
            "subtotal",
        )
        read_only_fields = ("unit_price", "subtotal")


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)

    def validate_product_id(self, value):
        try:
            Product.objects.get(id=value, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError(
                f"Producto con ID {value} no existe o no está disponible"
            )
        return value


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    order_items = OrderItemCreateSerializer(many=True, write_only=True, required=False)
    assigned_courier = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(profile__role=UserProfile.ROLE_COURIER),
        allow_null=True,
        required=False,
    )
    assigned_courier_display_name = serializers.SerializerMethodField()
    assigned_at = serializers.DateTimeField(read_only=True)

    estimated_delivery_time = serializers.CharField(read_only=True)
    created_by_username = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "customer_name",
            "customer_phone",
            "customer_email",
            "delivery_method",
            "status",
            "assigned_courier",
            "assigned_courier_display_name",
            "assigned_at",
            "order_source",
            "created_by",
            "created_by_username",
            "pickup_date",
            "pickup_time",
            "scheduled_date",
            "delivery_address",
            "address_validation_status",
            "address_validation_message",
            "delivery_latitude",
            "delivery_longitude",
            "delivery_distance_km",
            "delivery_maps_url",
            "estimated_delivery_time",
            "notes",
            "total_amount",
            "items",
            "order_items",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "total_amount")

    def get_created_by_username(self, obj):
        if obj.created_by_id and obj.created_by:
            return obj.created_by.username
        return None

    def get_assigned_courier_display_name(self, obj):
        if not obj.assigned_courier_id or not obj.assigned_courier:
            return None

        profile = get_user_profile(obj.assigned_courier)
        if profile and profile.full_name:
            return profile.full_name
        return obj.assigned_courier.username

    def validate(self, data):
        """
        Validación de datos en el serializer.
        - Para CREATE: valida completamente incluyendo horarios y disponibilidad
        - Para UPDATE: solo valida datos básicos (teléfono, courier)
        """
        data_without_items = data.copy()
        data_without_items.pop("order_items", None)

        if self.instance:
            # UPDATE: solo validación básica
            editable_fields = [
                field.name
                for field in Order._meta.fields
                if field.editable
                and field.name not in {"id", "created_at", "updated_at"}
            ]
            merged_data = {
                field_name: getattr(self.instance, field_name)
                for field_name in editable_fields
            }
            merged_data.update(data_without_items)
            instance = Order(**merged_data)
            instance.clean()
        else:
            # CREATE: validación completa
            instance = Order(**data_without_items)
            instance.clean()
            instance.validate_for_creation()

        return data

    @staticmethod
    def _validate_and_fill_delivery_data(data, delivery_method, delivery_address):
        if delivery_method != "delivery":
            return

        result = validate_delivery_address((delivery_address or "").strip())

        data["address_validation_status"] = result.status
        data["address_validation_message"] = result.message
        data["delivery_latitude"] = result.latitude
        data["delivery_longitude"] = result.longitude
        data["delivery_distance_km"] = result.distance_km
        data["delivery_maps_url"] = result.maps_url

        if result.status != "valid":
            raise serializers.ValidationError({"delivery_address": result.message})

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("order_items", [])

        if validated_data.get("assigned_courier") and not validated_data.get(
            "assigned_at"
        ):
            validated_data["assigned_at"] = timezone.now()

        self._validate_and_fill_delivery_data(
            validated_data,
            validated_data.get("delivery_method"),
            validated_data.get("delivery_address"),
        )

        order = super().create(validated_data)

        total = Decimal("0.00")

        for item_data in items_data:
            product = Product.objects.get(id=item_data["product_id"])
            quantity = item_data["quantity"]
            unit_price = product.price

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
            )

            total += unit_price * quantity

        order.total_amount = total
        order.save(update_fields=["total_amount"])

        return order

    def update(self, instance, validated_data):
        validated_data.pop("order_items", None)

        if "assigned_courier" in validated_data:
            next_assigned_courier = validated_data["assigned_courier"]
            if next_assigned_courier is None:
                instance.assigned_at = None
            elif next_assigned_courier != instance.assigned_courier or not instance.assigned_at:
                instance.assigned_at = timezone.now()

        effective_delivery_method = validated_data.get(
            "delivery_method", instance.delivery_method
        )
        effective_delivery_address = validated_data.get(
            "delivery_address", instance.delivery_address
        )

        should_revalidate_delivery = (
            "delivery_method" in validated_data
            or "delivery_address" in validated_data
            or instance.address_validation_status != "valid"
            or instance.delivery_latitude is None
            or instance.delivery_longitude is None
        )

        if effective_delivery_method == "delivery" and should_revalidate_delivery:
            self._validate_and_fill_delivery_data(
                validated_data,
                effective_delivery_method,
                effective_delivery_address,
            )

        return super().update(instance, validated_data)


class RestrictedDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestrictedDate
        fields = ("id", "date", "applies_to", "reason", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class OrderAvailabilityConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderAvailabilityConfig
        fields = (
            "pickup_weekday_open",
            "pickup_weekday_close",
            "pickup_sunday_open",
            "pickup_sunday_close",
            "delivery_weekday_open",
            "delivery_weekday_close",
            "delivery_sunday_open",
            "delivery_sunday_close",
            "is_accepting_orders",
            "order_notice",
            "updated_at",
        )
        read_only_fields = ("updated_at",)


class PublicOrderAvailabilitySerializer(serializers.ModelSerializer):
    restricted_dates = serializers.SerializerMethodField()

    class Meta:
        model = OrderAvailabilityConfig
        fields = (
            "pickup_weekday_open",
            "pickup_weekday_close",
            "pickup_sunday_open",
            "pickup_sunday_close",
            "delivery_weekday_open",
            "delivery_weekday_close",
            "delivery_sunday_open",
            "delivery_sunday_close",
            "is_accepting_orders",
            "order_notice",
            "restricted_dates",
            "updated_at",
        )

    def get_restricted_dates(self, _obj):
        queryset = RestrictedDate.objects.filter(is_active=True).order_by("date")
        return RestrictedDateSerializer(queryset, many=True).data


class DeliveryCoverageSettingsSerializer(serializers.ModelSerializer):
    local_latitude = serializers.DecimalField(
        max_digits=10,
        decimal_places=7,
        required=False,
        allow_null=True,
    )
    local_longitude = serializers.DecimalField(
        max_digits=10,
        decimal_places=7,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = DeliveryCoverageSettings
        fields = (
            "id",
            "name",
            "local_address",
            "local_city",
            "local_region",
            "local_country",
            "local_reference",
            "local_latitude",
            "local_longitude",
            "max_delivery_km",
            "is_enabled",
            "coverage_note",
            "updated_at",
        )

    def to_internal_value(self, data):
        mutable_data = data.copy()

        for field_name in ("local_latitude", "local_longitude"):
            if mutable_data.get(field_name) == "":
                mutable_data[field_name] = None

        if isinstance(mutable_data.get("max_delivery_km"), str):
            mutable_data["max_delivery_km"] = mutable_data["max_delivery_km"].replace(
                ",", "."
            )

        if not mutable_data.get("local_country"):
            mutable_data["local_country"] = "Colombia"

        return super().to_internal_value(mutable_data)

    def _build_geocode_query(self, attrs):
        parts = [
            attrs.get("local_address", ""),
            attrs.get("local_reference", ""),
            attrs.get("local_city", ""),
            attrs.get("local_region", ""),
            attrs.get("local_country", ""),
        ]
        return ", ".join([str(p).strip() for p in parts if str(p).strip()])

    def _resolve_coordinates(self, attrs):
        query = self._build_geocode_query(attrs)
        if not query:
            raise serializers.ValidationError(
                {"local_address": "Debe proporcionar una direccion valida."}
            )

        try:
            lat, lng = geocode_address(query)
        except DeliveryValidationError as exc:
            raise serializers.ValidationError({"local_address": str(exc)})

        attrs["local_latitude"] = lat
        attrs["local_longitude"] = lng

    def create(self, validated_data):
        self._resolve_coordinates(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        should_geocode = any(
            field in validated_data
            for field in ["local_address", "local_city", "local_region"]
        )

        if should_geocode:
            temp = {**validated_data}
            self._resolve_coordinates(temp)
            validated_data["local_latitude"] = temp["local_latitude"]
            validated_data["local_longitude"] = temp["local_longitude"]

        return super().update(instance, validated_data)
