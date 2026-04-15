from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from backend.catalog.models import Order
from backend.catalog.serializers import OrderSerializer


class MyOrderHistoryView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items__product")
            .order_by("-created_at")
        )
