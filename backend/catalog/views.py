from django.shortcuts import get_object_or_404
import logging
from rest_framework import filters, generics, status
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Category,
    DeliveryCoverageSettings,
    Order,
    OrderAvailabilityConfig,
    Product,
    RestrictedDate,
)
from .serializers import (
    CategorySerializer,
    DeliveryCoverageSettingsSerializer,
    OrderAvailabilityConfigSerializer,
    ProductAdminSerializer,
    ProductSerializer,
    PublicOrderAvailabilitySerializer,
    RestrictedDateSerializer,
    OrderSerializer,
)
from .services.delivery_geo import validate_delivery_address

logger = logging.getLogger(__name__)


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

        return queryset


class OrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Ver detalle de un pedido
    PUT/PATCH: Actualizar un pedido
    DELETE: Eliminar un pedido
    """

    serializer_class = OrderSerializer
    queryset = Order.objects.prefetch_related("items__product").all()


class AdminOrderAvailabilityConfigView(generics.RetrieveUpdateAPIView):
    serializer_class = OrderAvailabilityConfigSerializer
    permission_classes = (IsAdminUser,)

    def get_object(self):
        return OrderAvailabilityConfig.get_solo()


class AdminRestrictedDateListCreateView(generics.ListCreateAPIView):
    serializer_class = RestrictedDateSerializer
    permission_classes = (IsAdminUser,)
    queryset = RestrictedDate.objects.all().order_by("date")
    pagination_class = None


class AdminRestrictedDateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RestrictedDateSerializer
    permission_classes = (IsAdminUser,)
    queryset = RestrictedDate.objects.all()


class PublicOrderAvailabilityView(generics.RetrieveAPIView):
    serializer_class = PublicOrderAvailabilitySerializer
    permission_classes = (AllowAny,)

    def get_object(self):
        return OrderAvailabilityConfig.get_solo()


class DeliveryAddressValidationView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        raw_address = request.data.get("delivery_address", "")
        address = str(raw_address).strip()

        if not address:
            return Response(
                {
                    "status": "invalid",
                    "message": "Debe ingresar una direccion para validar.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validation = validate_delivery_address(address)
        return Response(
            {
                "status": validation.status,
                "message": validation.message,
                "latitude": validation.latitude,
                "longitude": validation.longitude,
                "distance_km": validation.distance_km,
                "delivery_maps_url": validation.maps_url,
            },
            status=status.HTTP_200_OK,
        )


class AdminDeliveryCoverageSettingsView(APIView):
    permission_classes = (IsAdminUser,)

    @staticmethod
    def _build_error_message(errors):
        if not errors:
            return "No se pudo guardar la cobertura."

        # Prioriza un mensaje legible a partir del primer error de campo.
        first_field, first_error = next(iter(errors.items()))
        if isinstance(first_error, str):
            return f"{first_field}: {first_error}"
        if isinstance(first_error, list) and first_error:
            return f"{first_field}: {first_error[0]}"
        if isinstance(first_error, dict):
            nested_field, nested_error = next(iter(first_error.items()))
            if isinstance(nested_error, list) and nested_error:
                return f"{first_field}.{nested_field}: {nested_error[0]}"
            return f"{first_field}.{nested_field}: {nested_error}"
        if first_error is not None:
            return f"{first_field}: {first_error}"
        return "No se pudo guardar la cobertura."

    def get(self, _request):
        latest = DeliveryCoverageSettings.objects.order_by("-updated_at", "-id").first()
        if latest:
            return Response(DeliveryCoverageSettingsSerializer(latest).data)

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

    def _save(self, request, partial: bool):
        instance = None
        instance_id = request.data.get("id")

        if instance_id:
            instance = get_object_or_404(DeliveryCoverageSettings, pk=instance_id)

        serializer = DeliveryCoverageSettingsSerializer(
            instance=instance,
            data=request.data,
            partial=partial,
        )
        if not serializer.is_valid():
            logger.warning(
                "Admin delivery coverage validation failed",
                extra={
                    "user_id": getattr(request.user, "id", None),
                    "payload": request.data,
                    "errors": serializer.errors,
                },
            )
            return Response(
                {
                    "detail": self._build_error_message(serializer.errors),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            saved = serializer.save()
        except serializers.ValidationError as exc:
            error_detail = (
                exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
            )
            logger.warning(
                "Admin delivery coverage save failed",
                extra={
                    "user_id": getattr(request.user, "id", None),
                    "payload": request.data,
                    "errors": error_detail,
                },
            )
            return Response(
                {
                    "detail": self._build_error_message(error_detail),
                    "errors": error_detail,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            DeliveryCoverageSettingsSerializer(saved).data,
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        # PUT se admite en modo parcial para mantener compatibilidad con el frontend.
        return self._save(request, partial=True)

    def patch(self, request):
        return self._save(request, partial=True)
