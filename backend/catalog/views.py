from django.shortcuts import get_object_or_404
from rest_framework import filters, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser

from .models import Category, Product, Order
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

    def get_queryset(self):
        queryset = Order.objects.prefetch_related("items__product").all()

        # Filtros opcionales
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)

        delivery_method = self.request.query_params.get("delivery_method")
        if delivery_method:
            queryset = queryset.filter(delivery_method=delivery_method)

        return queryset


class OrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Ver detalle de un pedido
    PUT/PATCH: Actualizar un pedido
    DELETE: Eliminar un pedido
    """

    serializer_class = OrderSerializer
    queryset = Order.objects.prefetch_related("items__product").all()
