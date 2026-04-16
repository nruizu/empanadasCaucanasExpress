from datetime import timedelta
import base64
import io
import matplotlib
import numpy as np
import seaborn as sns
from django.shortcuts import get_object_or_404
from django.db.models import DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from matplotlib import pyplot as plt
from backend.catalog.models import Order, OrderItem
from backend.catalog.serializers import OrderSerializer

matplotlib.use("Agg")


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
            return Response({"detail": "group_by invalido."}, status=400)

        range_key = request.query_params.get("range", "last_week")
        if range_key not in {"last_week", "last_month", "last_year", "all"}:
            return Response({"detail": "range invalido."}, status=400)

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
