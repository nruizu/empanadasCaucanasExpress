from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from unittest.mock import patch

from backend.catalog.models import Order, OrderNotification
from backend.login.models import UserProfile


class AdminOrderManagementTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            username="admin-orders",
            password="pass1234",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin)

        self.user = user_model.objects.create_user(
            username="cliente-orders",
            password="pass1234",
        )
        self.user_token = Token.objects.create(user=self.user)

        self.courier = user_model.objects.create_user(
            username="repartidor-orders",
            password="pass1234",
        )
        UserProfile.objects.create(
            user=self.courier,
            role=UserProfile.ROLE_COURIER,
            full_name="Repartidor Orders",
            phone="3002223344",
            address="Calle 123",
        )

    def _auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def _auth_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

    def test_admin_can_delete_order(self):
        order = Order.objects.create(
            customer_name="Cliente",
            customer_phone="3001112233",
            delivery_method="pickup",
            pickup_date="2026-04-15",
            pickup_time="12:00",
            status="pending",
        )

        self._auth_admin()
        response = self.client.delete(f"/api/orders/{order.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Order.objects.filter(id=order.id).exists())

    def test_admin_cannot_change_status_of_cancelled_order(self):
        order = Order.objects.create(
            customer_name="Cliente",
            customer_phone="3001112233",
            delivery_method="pickup",
            pickup_date="2026-04-15",
            pickup_time="12:00",
            status="cancelled",
            user=self.user,
        )

        self._auth_admin()
        response = self.client.patch(
            f"/api/orders/{order.id}/",
            {"status": "confirmed"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.data)

        order.refresh_from_db()
        self.assertEqual(order.status, "cancelled")

    @patch(
        "backend.catalog.views.notification_service.send_order_status_update",
        return_value=(True, "SM_STATUS_123", None),
    )
    def test_admin_status_change_sends_whatsapp_notification(self, mock_send):
        order = Order.objects.create(
            customer_name="Cliente",
            customer_phone="3001112233",
            delivery_method="pickup",
            pickup_date="2026-04-15",
            pickup_time="12:00",
            status="pending",
            user=self.user,
            order_source="online",
        )

        self._auth_admin()
        response = self.client.patch(
            f"/api/orders/{order.id}/",
            {"status": "preparing"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, "preparing")
        mock_send.assert_called_once()

        notification = OrderNotification.objects.filter(
            order=order,
            notification_type="status_update",
        ).latest("id")
        self.assertEqual(notification.status, "sent")
        self.assertEqual(notification.twilio_message_sid, "SM_STATUS_123")

    @patch(
        "backend.catalog.views.notification_service.send_order_status_update",
        return_value=(True, "SM_STATUS_456", None),
    )
    def test_admin_can_assign_courier_while_changing_status(self, mock_send):
        order = Order.objects.create(
            customer_name="Cliente",
            customer_phone="3001112233",
            delivery_method="delivery",
            delivery_address="Calle 10 # 20-30, Popayan",
            status="pending",
            user=self.user,
            order_source="online",
            address_validation_status="valid",
        )

        self._auth_admin()
        response = self.client.patch(
            f"/api/orders/{order.id}/",
            {
                "status": "preparing",
                "assigned_courier": self.courier.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, "preparing")
        self.assertEqual(order.assigned_courier_id, self.courier.id)
        self.assertIsNotNone(order.assigned_at)
        mock_send.assert_called_once()

    def test_non_admin_cannot_patch_order_detail(self):
        order = Order.objects.create(
            customer_name="Cliente",
            customer_phone="3001112233",
            delivery_method="pickup",
            pickup_date="2026-04-15",
            pickup_time="12:00",
            status="pending",
        )

        self._auth_user()
        response = self.client.patch(
            f"/api/orders/{order.id}/",
            {"status": "confirmed"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
