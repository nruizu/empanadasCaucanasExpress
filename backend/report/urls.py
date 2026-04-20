from django.urls import path
from .views import CancelMyOrderView, MyOrderHistoryView, SalesAnalysisView

urlpatterns = [
    path("orders/me/", MyOrderHistoryView.as_view(), name="api_my_order_history"),
    path(
        "orders/me/<int:pk>/cancel/",
        CancelMyOrderView.as_view(),
        name="api_my_order_cancel",
    ),
    path(
        "admin/sales/analysis/",
        SalesAnalysisView.as_view(),
        name="report-sales-analysis",
    ),
]
