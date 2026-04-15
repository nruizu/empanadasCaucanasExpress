from django.urls import path
from .views import MyOrderHistoryView

urlpatterns = [
    path("orders/me/", MyOrderHistoryView.as_view(), name="api_my_order_history"),
]
