from django.urls import path

from .views import (
    AdminManualSaleDeleteView,
    AdminManualSaleRegisterView,
    AdminSalesHistoryView,
    AdminSalesMetricsView,
)

urlpatterns = [
    path(
        "sales/history/",
        AdminSalesHistoryView.as_view(),
        name="admin-sales-history",
    ),
    path(
        "sales/metrics/",
        AdminSalesMetricsView.as_view(),
        name="admin-sales-metrics",
    ),
    path(
        "sales/register/",
        AdminManualSaleRegisterView.as_view(),
        name="admin-sales-register",
    ),
    path(
        "sales/<int:pk>/",
        AdminManualSaleDeleteView.as_view(),
        name="admin-sales-delete",
    ),
]
