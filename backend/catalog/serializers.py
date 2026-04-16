from rest_framework import serializers
from django.db import transaction
from .models import Category, Product, Order, OrderItem, DeliveryCoverageSettings
from .services.delivery_geo import (
    DeliveryValidationError,
    geocode_address,
    build_local_origin_query,
    validate_delivery_address,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        # Only the specified fields will be included in the API response
        fields = ("id", "name", "slug", "image")


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Product
        # Only the specified fields will be included in the API response
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
    """
    Serializer para items individuales de un pedido
    """

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


class OrderSerializer(serializers.ModelSerializer):
    """
    Serializer para pedidos - incluye validaciones de HU 4 y 5
    """

    items = OrderItemSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "customer_name",
            "customer_phone",
            "customer_email",
            "delivery_method",
            "status",
            "pickup_date",
            "pickup_time",
            "scheduled_date",
            "delivery_address",
            "delivery_latitude",
            "delivery_longitude",
            "delivery_distance_km",
            "address_validation_status",
            "address_validation_message",
            "delivery_maps_url",
            "notes",
            "total_amount",
            "order_source",
            "created_by",
            "created_by_username",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "total_amount",
            "order_source",
            "created_by",
            "created_by_username",
            "delivery_latitude",
            "delivery_longitude",
            "delivery_distance_km",
            "address_validation_status",
            "address_validation_message",
            "delivery_maps_url",
        )

    def get_total_amount(self, obj):
        if obj.total_amount:
            return obj.total_amount

        return sum(
            item.unit_price * item.quantity
            for item in obj.items.select_related("product").all()
        )

    def validate(self, data):
        """
        Validaciones personalizadas - llama al método clean del modelo.
        En updates parciales, combina los campos entrantes con los valores actuales
        para no invalidar cambios como actualizar solo el estado.
        """
        if (
            self.instance is not None
            and self.instance.status == "cancelled"
            and "status" in data
            and data["status"] != "cancelled"
        ):
            raise serializers.ValidationError(
                {"status": "Un pedido cancelado no puede cambiar de estado."}
            )

        if self.instance is not None:
            merged_data = {
                "delivery_method": data.get(
                    "delivery_method", self.instance.delivery_method
                ),
                "pickup_date": data.get("pickup_date", self.instance.pickup_date),
                "pickup_time": data.get("pickup_time", self.instance.pickup_time),
                "scheduled_date": data.get(
                    "scheduled_date", self.instance.scheduled_date
                ),
                "delivery_address": data.get(
                    "delivery_address", self.instance.delivery_address
                ),
            }
            instance = Order(**merged_data)
        else:
            instance = Order(**data)

        instance.clean()  # Esto ejecuta las validaciones de HU 4 y 5

        current_delivery_method = data.get(
            "delivery_method",
            self.instance.delivery_method if self.instance else None,
        )
        current_delivery_address = data.get(
            "delivery_address",
            self.instance.delivery_address if self.instance else None,
        )

        should_validate_delivery = current_delivery_method == "delivery" and (
            self.instance is None
            or "delivery_method" in data
            or "delivery_address" in data
        )

        if should_validate_delivery:
            result = validate_delivery_address(current_delivery_address or "")

            data["address_validation_status"] = result.status
            data["address_validation_message"] = result.message
            data["delivery_latitude"] = result.latitude
            data["delivery_longitude"] = result.longitude
            data["delivery_distance_km"] = result.distance_km
            data["delivery_maps_url"] = result.maps_url

            if result.status in {"invalid", "out_of_coverage", "service_error"}:
                raise serializers.ValidationError({"delivery_address": result.message})

        if current_delivery_method != "delivery":
            data["address_validation_status"] = "not_validated"
            data["address_validation_message"] = ""
            data["delivery_latitude"] = None
            data["delivery_longitude"] = None
            data["delivery_distance_km"] = None
            data["delivery_maps_url"] = ""

        return data


class DeliveryAddressValidationInputSerializer(serializers.Serializer):
    delivery_address = serializers.CharField(max_length=255)


class DeliveryAddressValidationResultSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[choice[0] for choice in Order.ADDRESS_VALIDATION_CHOICES]
    )
    message = serializers.CharField()
    latitude = serializers.DecimalField(
        max_digits=10,
        decimal_places=7,
        required=False,
        allow_null=True,
    )
    longitude = serializers.DecimalField(
        max_digits=10,
        decimal_places=7,
        required=False,
        allow_null=True,
    )
    distance_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    delivery_maps_url = serializers.CharField(required=False, allow_blank=True)


class DeliveryCoverageSettingsSerializer(serializers.ModelSerializer):
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
        read_only_fields = ("id", "updated_at")

    def validate(self, attrs):
        instance = self.instance
        local_address = attrs.get(
            "local_address",
            instance.local_address if instance else "",
        )
        local_city = attrs.get(
            "local_city",
            instance.local_city if instance else "",
        )
        local_region = attrs.get(
            "local_region",
            instance.local_region if instance else "",
        )
        local_country = attrs.get(
            "local_country",
            instance.local_country if instance else "Colombia",
        )
        local_reference = attrs.get(
            "local_reference",
            instance.local_reference if instance else "",
        )

        shadow_obj = DeliveryCoverageSettings(
            local_address=local_address,
            local_city=local_city,
            local_region=local_region,
            local_country=local_country,
            local_reference=local_reference,
        )
        origin_query = build_local_origin_query(shadow_obj)

        try:
            local_latitude, local_longitude = geocode_address(origin_query)
        except DeliveryValidationError as exc:
            raise serializers.ValidationError(
                {"local_address": f"No se pudo validar la direccion del local: {exc}"}
            )

        attrs["local_latitude"] = local_latitude
        attrs["local_longitude"] = local_longitude
        return attrs


class SalesHistoryQuerySerializer(serializers.Serializer):
    """Valida filtros de consulta para historial y métricas de ventas."""

    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    status = serializers.ChoiceField(
        choices=[choice[0] for choice in Order.STATUS_CHOICES],
        required=False,
    )
    order_source = serializers.ChoiceField(
        choices=[choice[0] for choice in Order.SOURCE_CHOICES],
        required=False,
    )
    delivery_method = serializers.ChoiceField(
        choices=[choice[0] for choice in Order.DELIVERY_CHOICES],
        required=False,
    )
    time_basis = serializers.ChoiceField(
        choices=("created", "service"),
        required=False,
        default="created",
    )

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError(
                {"end_date": "Debe ser mayor o igual a start_date."}
            )

        return attrs


class ManualSaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.PrimaryKeyRelatedField(
        source="product",
        queryset=Product.objects.filter(is_active=True),
    )
    quantity = serializers.IntegerField(min_value=1)


class AdminManualSaleCreateSerializer(serializers.ModelSerializer):
    items = ManualSaleItemInputSerializer(many=True, write_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "customer_name",
            "customer_phone",
            "customer_email",
            "status",
            "notes",
            "items",
            "total_amount",
            "order_source",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "total_amount",
            "order_source",
            "created_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        items = attrs.get("items")
        if not items:
            raise serializers.ValidationError(
                {"items": "Debe incluir al menos un producto."}
            )

        product_ids = [item["product"].id for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError(
                {"items": "No repitas el mismo producto en múltiples filas."}
            )

        instance = Order(
            customer_name=attrs.get("customer_name", ""),
            customer_phone=attrs.get("customer_phone", ""),
            customer_email=attrs.get("customer_email"),
            delivery_method="delivery",
            status=attrs.get("status", "completed"),
            delivery_address="Venta registrada en tienda fisica",
            notes=attrs.get("notes"),
        )
        instance.clean()
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context.get("request")
        admin_user = request.user if request else None

        validated_data["delivery_method"] = "delivery"
        validated_data["delivery_address"] = "Venta registrada en tienda fisica"
        validated_data["order_source"] = "manual"
        validated_data["created_by"] = admin_user

        order = Order.objects.create(**validated_data)

        total_amount = 0
        order_items = []
        for item_data in items_data:
            product = item_data["product"]
            quantity = item_data["quantity"]
            unit_price = product.price
            total_amount += unit_price * quantity
            order_items.append(
                OrderItem(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price,
                )
            )

        OrderItem.objects.bulk_create(order_items)
        order.total_amount = total_amount
        order.save(update_fields=["total_amount"])
        return order
