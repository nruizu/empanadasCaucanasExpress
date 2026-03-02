from rest_framework import serializers

from backend.catalog.models import Product
from backend.catalog.serializers import ProductSerializer

from .models import Cart, CartProduct


class CartProductSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True),
        write_only=True,
        source="product"
    )

    class Meta:
        model = CartProduct
        fields = ["id", "product", "product_id", "quantity"]


class CartSerializer(serializers.ModelSerializer):
    # alias products to the through model so the frontend keeps the same
    # schema it was originally expecting (items with product and quantity).
    products = CartProductSerializer(many=True, read_only=True, source="cart_products")
    total_price = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            "id",
            "created_at",
            "updated_at",
            "products",
            "total_price",
            "total_items",
        ]

    def get_total_price(self, obj):
        # iterate over CartProduct instances rather than products (which would
        # yield Product objects and lose quantity information)
        return sum(
            cp.product.price * cp.quantity
            for cp in obj.cart_products.all()
        )

    def get_total_items(self, obj):
        return sum(
            cp.quantity
            for cp in obj.cart_products.all()
        )
