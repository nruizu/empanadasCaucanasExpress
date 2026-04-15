from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser

from backend.cart.models import Cart

from .models import Category, Product, Order
from .models import OrderItem
from .serializers import (
    CategorySerializer,
    ProductAdminSerializer,
    ProductSerializer,
    OrderSerializer,
)


class ProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ActiveCategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(is_active=True)


class ActiveProductBaseListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination
    filter_backends = (filters.OrderingFilter, filters.SearchFilter)
    ordering_fields = ("name", "price")
    ordering = ("name",)
    search_fields = ("name", "description")

    def get_queryset(self):
        queryset = Product.objects.select_related("category").filter(
            is_active=True,
            category__is_active=True,
        )

        category_slug = self.request.query_params.get("category")
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        min_price = self.request.query_params.get("min_price")
        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        max_price = self.request.query_params.get("max_price")
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        return queryset


class ActiveProductListView(ActiveProductBaseListView):
    pass


class FeaturedProductListView(ActiveProductBaseListView):
    pagination_class = None

    def get_queryset(self):
        return super().get_queryset().filter(is_featured=True)


class CategoryProductListView(ActiveProductBaseListView):
    def get_queryset(self):
        category = get_object_or_404(
            Category,
            slug=self.kwargs["slug"],
            is_active=True,
        )
        return super().get_queryset().filter(category=category)


class AdminProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductAdminSerializer
    permission_classes = (IsAdminUser,)
    pagination_class = ProductPagination
    filter_backends = (filters.OrderingFilter, filters.SearchFilter)
    ordering_fields = ("name", "price", "is_active", "is_featured")
    ordering = ("name",)
    search_fields = ("name", "description", "slug")

    def get_queryset(self):
        return Product.objects.select_related("category").all()


class AdminProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductAdminSerializer
    permission_classes = (IsAdminUser,)
    queryset = Product.objects.select_related("category").all()


class OrderListCreateView(generics.ListCreateAPIView):
    """
    GET: Lista todos los pedidos
    POST: Crea un nuevo pedido
    """

    serializer_class = OrderSerializer
    pagination_class = ProductPagination
    filter_backends = (filters.OrderingFilter, filters.SearchFilter)
    ordering_fields = ("created_at", "status", "pickup_date", "scheduled_date")
    ordering = ("-created_at",)
    search_fields = ("customer_name", "customer_phone", "customer_email")

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Order.objects.prefetch_related("items__product").all()

        # Filtros opcionales
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)

        delivery_method = self.request.query_params.get("delivery_method")
        if delivery_method:
            queryset = queryset.filter(delivery_method=delivery_method)

        today = self.request.query_params.get("today")
        if today and today.lower() in {"1", "true", "yes", "si"}:
            queryset = queryset.filter(created_at__date=timezone.localdate())

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_authenticated:
            serializer.save()
            return

        profile = getattr(user, "profile", None)
        validated_data = serializer.validated_data

        order_data = {
            "user": user,
            "customer_name": validated_data.get("customer_name")
            or (profile.full_name if profile else "")
            or user.username,
            "customer_phone": validated_data.get("customer_phone")
            or (profile.phone if profile else ""),
            "customer_email": validated_data.get("customer_email") or user.email,
        }

        if validated_data.get("delivery_method") == "delivery":
            order_data["delivery_address"] = validated_data.get("delivery_address") or (
                profile.address if profile else ""
            )

        with transaction.atomic():
            order = serializer.save(**order_data)

            cart, _ = Cart.objects.get_or_create(user=user)
            cart_items = cart.cart_products.select_related("product").all()

            total_amount = 0
            order_items = []

            for cart_item in cart_items:
                unit_price = cart_item.product.price
                subtotal = unit_price * cart_item.quantity
                total_amount += subtotal
                order_items.append(
                    OrderItem(
                        order=order,
                        product=cart_item.product,
                        quantity=cart_item.quantity,
                        unit_price=unit_price,
                    )
                )

            if order_items:
                OrderItem.objects.bulk_create(order_items)

            order.total_amount = total_amount
            order.save(update_fields=["total_amount"])


class OrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Ver detalle de un pedido
    PUT/PATCH: Actualizar un pedido
    DELETE: Eliminar un pedido
    """

    serializer_class = OrderSerializer
    permission_classes = (IsAdminUser,)
    queryset = Order.objects.prefetch_related("items__product").all()
