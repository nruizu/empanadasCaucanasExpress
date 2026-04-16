from datetime import timedelta

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.shortcuts import get_object_or_404

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
