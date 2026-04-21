from datetime import date, timedelta
import base64
import io
import matplotlib
import numpy as np
import seaborn as sns
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.shortcuts import get_object_or_404
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from matplotlib import pyplot as plt
from backend.catalog.models import Order, OrderItem, Product
from backend.catalog.serializers import OrderSerializer

matplotlib.use("Agg")


class SalesPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ManualSaleItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class ManualSaleSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=200)
    customer_phone = serializers.CharField(max_length=20)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=[
            ("pending", "Pendiente"),
            ("confirmed", "Confirmado"),
            ("preparing", "En preparación"),
            ("ready", "Listo"),
            ("completed", "Completado"),
        ],
        required=False,
        default="completed",
    )
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    items = ManualSaleItemSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("items no puede estar vacío")

        product_ids = [item["product_id"] for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError("items contiene productos duplicados")

        return items

    def create(self, validated_data):
        items = validated_data.pop("items")
        user = self.context["request"].user

        order = Order.objects.create(
            **validated_data,
            delivery_method="pickup",
            order_source="manual",
            created_by=user,
            user=user,
            total_amount=Decimal("0.00"),
        )

        total_amount = Decimal("0.00")
        order_items = []

        for item in items:
            try:
                product = Product.objects.get(pk=item["product_id"])
            except Product.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"items": [f"Producto inválido: {item['product_id']}"]}
                ) from exc
            quantity = item["quantity"]
            total_amount += product.price * quantity
            order_items.append(
                OrderItem(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price,
                )
            )

        OrderItem.objects.bulk_create(order_items)
        order.total_amount = total_amount
        order.save(update_fields=["total_amount", "updated_at"])
        return order


def _parse_date(value: str | None, field_name: str):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise serializers.ValidationError({field_name: "Fecha inválida."}) from exc


def _service_date_filter(queryset, start_date=None, end_date=None):
    service_query = Q()

    if start_date:
        service_query &= (
            Q(delivery_method="delivery", created_at__date__gte=start_date)
            | Q(delivery_method="pickup", pickup_date__gte=start_date)
            | Q(delivery_method="scheduled", scheduled_date__gte=start_date)
        )

    if end_date:
        service_query &= (
            Q(delivery_method="delivery", created_at__date__lte=end_date)
            | Q(delivery_method="pickup", pickup_date__lte=end_date)
            | Q(delivery_method="scheduled", scheduled_date__lte=end_date)
        )

    return queryset.filter(service_query)


def _filtered_sales_queryset(request):
    queryset = Order.objects.select_related("created_by").prefetch_related(
        "items__product__category"
    )

    start_date = _parse_date(request.query_params.get("start_date"), "start_date")
    end_date = _parse_date(request.query_params.get("end_date"), "end_date")

    if start_date and end_date and end_date < start_date:
        raise serializers.ValidationError({"end_date": "Debe ser mayor o igual a start_date."})

    status_value = request.query_params.get("status")
    if status_value:
        queryset = queryset.filter(status=status_value)

    order_source = request.query_params.get("order_source")
    if order_source:
        queryset = queryset.filter(order_source=order_source)

    delivery_method = request.query_params.get("delivery_method")
    if delivery_method:
        queryset = queryset.filter(delivery_method=delivery_method)

    time_basis = request.query_params.get("time_basis", "created")
    if time_basis not in {"created", "service"}:
        raise serializers.ValidationError({"time_basis": "Valor inválido."})

    if time_basis == "created":
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
    else:
        queryset = _service_date_filter(queryset, start_date, end_date)

    return queryset.order_by("-created_at")


class AdminSalesHistoryView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = (IsAdminUser,)
    pagination_class = SalesPagination

    def get_queryset(self):
        return _filtered_sales_queryset(self.request)


class AdminSalesMetricsView(APIView):
    permission_classes = (IsAdminUser,)

    def get(self, request):
        queryset = _filtered_sales_queryset(request)
        aggregates = queryset.aggregate(
            total_sold=Coalesce(
                Sum("total_amount"),
                Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            ),
        )
        total_orders = queryset.count()
        total_sold = Decimal(str(aggregates["total_sold"]))
        average_ticket = (total_sold / total_orders) if total_orders else Decimal("0.00")

        by_delivery_method = []
        for delivery_method in ("pickup", "delivery", "scheduled"):
            method_queryset = queryset.filter(delivery_method=delivery_method)
            method_total_sold = method_queryset.aggregate(
                total_sold=Coalesce(
                    Sum("total_amount"),
                    Value(Decimal("0.00")),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                )
            )["total_sold"]
            by_delivery_method.append(
                {
                    "delivery_method": delivery_method,
                    "total_orders": method_queryset.count(),
                    "total_sold": str(Decimal(str(method_total_sold))),
                }
            )

        return Response(
            {
                "filters": {
                    "start_date": request.query_params.get("start_date") or None,
                    "end_date": request.query_params.get("end_date") or None,
                    "status": request.query_params.get("status") or None,
                    "order_source": request.query_params.get("order_source") or None,
                    "delivery_method": request.query_params.get("delivery_method") or None,
                    "time_basis": request.query_params.get("time_basis") or None,
                },
                "total_sold": str(total_sold),
                "total_orders": total_orders,
                "average_ticket": str(average_ticket.quantize(Decimal("0.01"))),
                "by_delivery_method": by_delivery_method,
            }
        )


class AdminManualSaleRegisterView(APIView):
    permission_classes = (IsAdminUser,)

    def post(self, request):
        serializer = ManualSaleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class AdminManualSaleDeleteView(APIView):
    permission_classes = (IsAdminUser,)

    def delete(self, request, pk: int):
        order = get_object_or_404(Order, pk=pk, order_source="manual")
        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyOrderHistoryView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items__product")
            .order_by("-created_at")
        )


class CancelMyOrderView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk: int):
        order = get_object_or_404(Order, pk=pk, user=request.user)

        if order.status in {"cancelled", "completed"}:
            return Response(
                {"detail": "Este pedido ya no se puede cancelar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cancel_deadline = order.created_at + timedelta(minutes=5)
        if timezone.now() > cancel_deadline:
            return Response(
                {
                    "detail": (
                        "Solo puedes cancelar pedidos durante los primeros 5 minutos."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = "cancelled"
        order.save(update_fields=["status", "updated_at"])

        serializer = OrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)


def _date_range_start(range_key):
    if range_key == "last_month":
        return timezone.now() - timedelta(days=30)
    if range_key == "last_year":
        return timezone.now() - timedelta(days=365)
    if range_key == "all":
        return None
    return timezone.now() - timedelta(days=7)


def _build_sales_series(orders, group_by):
    if not orders:
        if group_by == "weekday":
            weekday_labels = [
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
                "Domingo",
            ]
            return [
                {
                    "label": label,
                    "total_sold": 0.0,
                    "total_orders": 0,
                }
                for label in weekday_labels
            ]
        return []

    amounts = np.array(
        [float(order.total_amount or 0) for order in orders], dtype=float
    )

    if group_by == "weekday":
        weekday_labels = [
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado",
            "Domingo",
        ]
        indices = np.array([order.created_at.weekday() for order in orders], dtype=int)
        sums = np.bincount(indices, weights=amounts, minlength=7)
        counts = np.bincount(indices, minlength=7)
        return [
            {
                "label": weekday_labels[idx],
                "total_sold": float(sums[idx]),
                "total_orders": int(counts[idx]),
            }
            for idx in range(7)
        ]

    buckets = {}
    for order, amount in zip(orders, amounts):
        if group_by == "month":
            key = order.created_at.strftime("%Y-%m")
        else:
            iso_year, iso_week, _ = order.created_at.isocalendar()
            key = f"{iso_year}-W{iso_week:02d}"

        if key not in buckets:
            buckets[key] = {"total_sold": 0.0, "total_orders": 0}
        buckets[key]["total_sold"] += float(amount)
        buckets[key]["total_orders"] += 1

    return [
        {
            "label": label,
            "total_sold": values["total_sold"],
            "total_orders": values["total_orders"],
        }
        for label, values in sorted(buckets.items(), key=lambda item: item[0])
    ]


def _build_bar_chart_image(labels, values, title, y_label, color="#1f7a4f"):
    fig, ax = plt.subplots(figsize=(12, 4.8))
    sns.barplot(x=labels, y=values, ax=ax, color=color)
    ax.set_title(title)
    ax.set_xlabel("")
    ax.set_ylabel(y_label)
    ax.tick_params(axis="x", rotation=35)
    fig.tight_layout()

    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=140)
    plt.close(fig)
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


class SalesAnalysisView(APIView):
    permission_classes = (IsAdminUser,)

    def get(self, request):
        group_by = request.query_params.get("group_by", "weekday")
        if group_by not in {"weekday", "week", "month"}:
            return Response({"detail": "group_by inválido."}, status=400)

        range_key = request.query_params.get("range", "last_week")
        if range_key not in {"last_week", "last_month", "last_year", "all"}:
            return Response({"detail": "range inválido."}, status=400)

        base_queryset = Order.objects.exclude(status="cancelled").prefetch_related(
            "items__product__category"
        )
        queryset = base_queryset
        range_start = _date_range_start(range_key)
        if range_start is not None:
            queryset = queryset.filter(created_at__gte=range_start)

        effective_range = range_key
        if range_key == "last_week" and not queryset.exists():
            queryset = base_queryset
            effective_range = "all"

        orders = list(queryset)
        sales_series = _build_sales_series(orders, group_by)
        series_labels = [point["label"] for point in sales_series]
        series_values = [float(point["total_sold"]) for point in sales_series]

        sales_chart = _build_bar_chart_image(
            series_labels or ["Sin datos"],
            series_values or [0.0],
            title="Ventas completadas",
            y_label="Ingresos",
            color="#2f855a",
        )

        item_revenue = ExpressionWrapper(
            F("quantity") * F("unit_price"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )

        items_queryset = OrderItem.objects.filter(order__in=queryset)

        top_products = list(
            items_queryset.values(
                "product_id",
                "product__name",
                "product__category__name",
            )
            .annotate(
                total_quantity=Coalesce(Sum("quantity"), Value(0)),
                total_sold=Coalesce(
                    Sum(item_revenue),
                    Value(0),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                ),
            )
            .order_by("-total_quantity", "-total_sold")[:6]
        )

        category_sales = list(
            items_queryset.values("product__category__name")
            .annotate(
                total_sold=Coalesce(
                    Sum(item_revenue),
                    Value(0),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                ),
                total_quantity=Coalesce(Sum("quantity"), Value(0)),
            )
            .order_by("-total_sold")
        )

        category_labels = [
            item["product__category__name"] or "Sin categoría"
            for item in category_sales
        ]
        category_values = [float(item["total_sold"] or 0) for item in category_sales]

        category_chart = _build_bar_chart_image(
            category_labels or ["Sin datos"],
            category_values or [0.0],
            title="Ventas por categoría",
            y_label="Ingresos",
            color="#285e61",
        )

        response_data = {
            "filters": {
                "group_by": group_by,
                "range": range_key,
                "effective_range": effective_range,
            },
            "summary": {
                "total_orders": len(orders),
                "total_sold": float(sum(series_values)),
            },
            "sales_series": sales_series,
            "sales_chart_image": sales_chart,
            "top_products": [
                {
                    "product_id": item["product_id"],
                    "name": item["product__name"],
                    "category": item["product__category__name"],
                    "total_quantity": int(item["total_quantity"]),
                    "total_sold": float(item["total_sold"] or 0),
                }
                for item in top_products
            ],
            "category_sales": [
                {
                    "category": item["product__category__name"] or "Sin categoría",
                    "total_quantity": int(item["total_quantity"]),
                    "total_sold": float(item["total_sold"] or 0),
                }
                for item in category_sales
            ],
            "category_chart_image": category_chart,
        }
        return Response(response_data)
