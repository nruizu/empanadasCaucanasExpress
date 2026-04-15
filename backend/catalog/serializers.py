from rest_framework import serializers
from .models import Category, Product, Order, OrderItem


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
            "notes",
            "total_amount",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "total_amount")

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
            }
            instance = Order(**merged_data)
        else:
            instance = Order(**data)

        instance.clean()  # Esto ejecuta las validaciones de HU 4 y 5
        return data
