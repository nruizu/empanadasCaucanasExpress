from django.urls import path
from .views import MyOrderHistoryView, SalesAnalysisView

urlpatterns = [
    path("orders/me/", MyOrderHistoryView.as_view(), name="api_my_order_history"),
    path(
        "admin/sales/analysis/",
        SalesAnalysisView.as_view(),
        name="report-sales-analysis",
    ),
]
