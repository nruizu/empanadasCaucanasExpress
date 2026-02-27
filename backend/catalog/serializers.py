from rest_framework import serializers

from .models import Category, Product


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
