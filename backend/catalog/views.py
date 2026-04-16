from django.shortcuts import get_object_or_404
from django.db.models import Avg, Case, Count, DateField, DecimalField, Sum, Value, When
from django.db.models.functions import Coalesce, TruncDate
from rest_framework import filters, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.utils import timezone

from backend.cart.models import Cart

from .models import Category, Product, Order
from .models import DeliveryCoverageSettings, OrderItem
from .serializers import (
    AdminManualSaleCreateSerializer,
    CategorySerializer,
    DeliveryCoverageSettingsSerializer,
    DeliveryAddressValidationInputSerializer,
    DeliveryAddressValidationResultSerializer,
    ProductAdminSerializer,
    ProductSerializer,
    OrderSerializer,
    SalesHistoryQuerySerializer,
)
from .services.delivery_geo import validate_delivery_address


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


class DeliveryAddressValidationView(APIView):
    """Prevalida direcciones para pedidos de domicilio."""

    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = DeliveryAddressValidationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        address = serializer.validated_data["delivery_address"]
        result = validate_delivery_address(address)

        result_serializer = DeliveryAddressValidationResultSerializer(
            data={
                "status": result.status,
                "message": result.message,
                "latitude": result.latitude,
                "longitude": result.longitude,
                "distance_km": result.distance_km,
                "delivery_maps_url": result.maps_url,
            }
        )
        result_serializer.is_valid(raise_exception=True)

        status_code = 200 if result.status == "valid" else 400
        return Response(result_serializer.validated_data, status=status_code)


class AdminDeliveryCoverageSettingsView(APIView):
    """Obtiene y actualiza configuracion de cobertura para domicilios."""

    permission_classes = (IsAdminUser,)

    def get(self, request):
        settings_obj = DeliveryCoverageSettings.objects.order_by("-updated_at").first()
        if not settings_obj:
            return Response(
                {
                    "id": None,
                    "name": "Cobertura principal",
                    "local_address": "",
                    "local_city": "",
                    "local_region": "",
                    "local_country": "Colombia",
                    "local_reference": "",
                    "local_latitude": "",
                    "local_longitude": "",
                    "max_delivery_km": "",
                    "is_enabled": True,
                    "coverage_note": "",
                    "updated_at": None,
                }
            )

        serializer = DeliveryCoverageSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def put(self, request):
        settings_id = request.data.get("id")
        settings_obj = None
        if settings_id:
            settings_obj = get_object_or_404(
                DeliveryCoverageSettings,
                id=settings_id,
            )
        else:
            settings_obj = DeliveryCoverageSettings.objects.order_by(
                "-updated_at"
            ).first()

        if settings_obj is None:
            serializer = DeliveryCoverageSettingsSerializer(data=request.data)
        else:
            serializer = DeliveryCoverageSettingsSerializer(
                settings_obj,
                data=request.data,
                partial=True,
            )

        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _annotate_service_date(queryset):
    return queryset.annotate(
        service_date=Case(
            When(delivery_method="pickup", then="pickup_date"),
            When(delivery_method="scheduled", then="scheduled_date"),
            default=TruncDate("created_at"),
            output_field=DateField(),
        )
    )


def _apply_sales_filters(queryset, params):
    status = params.get("status")
    if status:
        queryset = queryset.filter(status=status)

    order_source = params.get("order_source")
    if order_source:
        queryset = queryset.filter(order_source=order_source)

    delivery_method = params.get("delivery_method")
    if delivery_method:
        queryset = queryset.filter(delivery_method=delivery_method)

    start_date = params.get("start_date")
    end_date = params.get("end_date")
    time_basis = params.get("time_basis", "created")

    if start_date or end_date:
        if time_basis == "service":
            queryset = _annotate_service_date(queryset)
            if start_date:
                queryset = queryset.filter(service_date__gte=start_date)
            if end_date:
                queryset = queryset.filter(service_date__lte=end_date)
        else:
            if start_date:
                queryset = queryset.filter(created_at__date__gte=start_date)
            if end_date:
                queryset = queryset.filter(created_at__date__lte=end_date)

    return queryset


class SalesHistoryListView(generics.ListAPIView):
    """Historial de ventas para usuarios autorizados."""

    serializer_class = OrderSerializer
    permission_classes = (IsAdminUser,)
    pagination_class = ProductPagination
    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ("created_at", "total_amount", "status")
    ordering = ("-created_at",)

    def get_queryset(self):
        query_serializer = SalesHistoryQuerySerializer(data=self.request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        queryset = Order.objects.prefetch_related("items__product").all()
        return _apply_sales_filters(queryset, params)


class SalesMetricsView(APIView):
    """Métricas básicas de ventas para supervisión y administración."""

    permission_classes = (IsAdminUser,)

    def get(self, request):
        query_serializer = SalesHistoryQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        queryset = _apply_sales_filters(Order.objects.all(), params)

        base = queryset.aggregate(
            total_sold=Coalesce(
                Sum("total_amount"),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
            total_orders=Count("id"),
            average_ticket=Coalesce(
                Avg("total_amount"),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )

        by_delivery = queryset.values("delivery_method").annotate(
            total_orders=Count("id"),
            total_sold=Coalesce(
                Sum("total_amount"),
                Value(0),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )

        response_data = {
            "filters": {
                "start_date": params.get("start_date"),
                "end_date": params.get("end_date"),
                "status": params.get("status"),
                "order_source": params.get("order_source"),
                "delivery_method": params.get("delivery_method"),
                "time_basis": params.get("time_basis", "created"),
            },
            "total_sold": base["total_sold"],
            "total_orders": base["total_orders"],
            "average_ticket": base["average_ticket"],
            "by_delivery_method": list(by_delivery),
        }
        return Response(response_data)


class AdminManualSaleCreateView(generics.CreateAPIView):
    """Registro manual de ventas por parte de usuarios administrativos."""

    serializer_class = AdminManualSaleCreateSerializer
    permission_classes = (IsAdminUser,)


class AdminManualSaleDeleteView(generics.DestroyAPIView):
    """Permite eliminar ventas manuales desde la vista administrativa."""

    permission_classes = (IsAdminUser,)
    queryset = Order.objects.filter(order_source="manual")
