from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Cart, CartProduct
from .serializers import CartSerializer


class CartViewSet(viewsets.ModelViewSet):
    serializer_class = CartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Cart.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"])
    def my_cart(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def create_cart(self, request):
        cart = Cart.objects.create(user=request.user)
        serializer = self.get_serializer(cart)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def add_product(self, request):
        product_id = request.data.get("product_id")
        quantity = request.data.get("quantity", 1)

        if not product_id:
            return Response(
                {"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            quantity = int(quantity)
            if quantity < 1:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"error": "quantity must be a positive integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)

        cart_product, created = CartProduct.objects.get_or_create(
            cart=cart, product_id=product_id, defaults={"quantity": quantity}
        )

        if not created:
            cart_product.quantity += quantity
            cart_product.save()

        serializer = self.get_serializer(cart)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"])
    def remove_product(self, request, pk=None):
        """Remove a product from the cart."""
        cart = self.get_object()
        cart_product_id = request.data.get("cart_product_id")

        if not cart_product_id:
            return Response(
                {"error": "cart_product_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cart_product = CartProduct.objects.get(id=cart_product_id, cart=cart)
            cart_product.delete()
        except CartProduct.DoesNotExist:
            return Response(
                {"error": "Product not found in cart"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(cart)
        return Response(serializer.data)

    @action(detail=True, methods=["delete"])
    def clear_cart(self, request, pk=None):
        """Clear all products from the cart."""
        cart = self.get_object()
        cart.cart_products.all().delete()
        serializer = self.get_serializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=["patch"])
    @transaction.atomic
    def update_quantity(self, request):
        """Update the quantity of a product in the cart."""
        cart_product_id = request.data.get("cart_product_id")
        quantity = request.data.get("quantity")

        if not cart_product_id:
            return Response(
                {"error": "cart_product_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            quantity = int(quantity)
            if quantity < 1:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"error": "quantity must be a positive integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = Cart.objects.get(user=request.user)

        try:
            cart_product = CartProduct.objects.get(id=cart_product_id, cart=cart)
            cart_product.quantity = quantity
            cart_product.save()
        except CartProduct.DoesNotExist:
            return Response(
                {"error": "Product not found in cart"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(cart)
        return Response(serializer.data)
