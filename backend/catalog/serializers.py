from rest_framework import serializers
from .models import (
    Category,
    Product,
    Order,
    OrderItem,
    OrderAvailabilityConfig,
    RestrictedDate,
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
    estimated_delivery_time = serializers.CharField(read_only=True)

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
            "estimated_delivery_time",
            "notes",
            "total_amount",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "total_amount")

    def validate(self, data):
        """
        Validaciones personalizadas - llama al método clean del modelo
        """
        instance = Order(**data)
        instance.clean()  # Esto ejecuta las validaciones de HU 4 y 5
        return data


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
