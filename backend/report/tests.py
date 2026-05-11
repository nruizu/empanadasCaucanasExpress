from datetime import timedelta
from decimal import Decimal
from datetime import time

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from backend.catalog.models import Category, Order, OrderItem, Product


class CancelMyOrderApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="cliente_cancel",
            password="Pass12345!",
        )
        self.token = Token.objects.create(user=self.user)

        self.other_user = User.objects.create_user(
            username="otro_cliente",
            password="Pass12345!",
        )
        self.other_token = Token.objects.create(user=self.other_user)

    def _auth_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def _auth_other_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.other_token.key}")

    def test_user_can_cancel_own_order_within_5_minutes(self):
        order = Order.objects.create(
            user=self.user,
            customer_name="Cliente",
            customer_phone="3000000000",
            delivery_method="pickup",
            pickup_date=timezone.localdate(),
            pickup_time=timezone.localtime().time().replace(second=0, microsecond=0),
            status="pending",
        )

        self._auth_user()
        response = self.client.post(f"/api/report/orders/me/{order.id}/cancel/")

        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, "cancelled")

    def test_user_cannot_cancel_after_5_minutes(self):
        order = Order.objects.create(
            user=self.user,
            customer_name="Cliente",
            customer_phone="3000000000",
            delivery_method="pickup",
            pickup_date=timezone.localdate(),
            pickup_time=timezone.localtime().time().replace(second=0, microsecond=0),
            status="pending",
        )
        old_created_at = timezone.now() - timedelta(minutes=6)
        Order.objects.filter(pk=order.pk).update(created_at=old_created_at)

        self._auth_user()
        response = self.client.post(f"/api/report/orders/me/{order.id}/cancel/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("5 minutos", response.data["detail"])

    def test_user_cannot_cancel_someone_elses_order(self):
        order = Order.objects.create(
            user=self.other_user,
            customer_name="Otro",
            customer_phone="3001111111",
            delivery_method="pickup",
            pickup_date=timezone.localdate(),
            pickup_time=timezone.localtime().time().replace(second=0, microsecond=0),
            status="pending",
        )

        self._auth_user()
        response = self.client.post(f"/api/report/orders/me/{order.id}/cancel/")
        self.assertEqual(response.status_code, 404)


class OrderHistoryAndSalesReportApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.customer = User.objects.create_user(
            username="cliente_historial",
            password="Pass12345!",
        )
        self.customer_token = Token.objects.create(user=self.customer)

        self.other_customer = User.objects.create_user(
            username="cliente_otro_historial",
            password="Pass12345!",
        )

        self.admin_user = User.objects.create_user(
            username="admin_reportes",
            password="AdminPass123!",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        self.category = Category.objects.create(
            name="Empanadas",
            slug="empanadas",
            is_active=True,
        )
        self.product = Product.objects.create(
            name="Empanada de queso",
            slug="empanada-queso",
            description="",
            price=Decimal("5000.00"),
            category=self.category,
            is_active=True,
        )

        self.customer_order = Order.objects.create(
            user=self.customer,
            customer_name="Cliente Historial",
            customer_phone="3000001111",
            customer_email="cliente@example.com",
            delivery_method="pickup",
            pickup_date=timezone.localdate(),
            pickup_time=time(11, 0),
            status="completed",
            total_amount=Decimal("10000.00"),
        )
        OrderItem.objects.create(
            order=self.customer_order,
            product=self.product,
            quantity=2,
            unit_price=Decimal("5000.00"),
        )

        self.other_order = Order.objects.create(
            user=self.other_customer,
            customer_name="Otro Cliente",
            customer_phone="3000002222",
            delivery_method="pickup",
            pickup_date=timezone.localdate(),
            pickup_time=time(12, 0),
            status="completed",
            total_amount=Decimal("5000.00"),
        )

    def _auth_customer(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.customer_token.key}")

    def _auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def _clear_auth(self):
        self.client.credentials()

    def test_orders_me_returns_only_authenticated_customer_orders(self):
        self._auth_customer()

        response = self.client.get("/api/report/orders/me/")

        self.assertEqual(response.status_code, 200)
        result_ids = [item["id"] for item in response.data["results"]]
        self.assertIn(self.customer_order.id, result_ids)
        self.assertNotIn(self.other_order.id, result_ids)

    def test_orders_me_requires_authentication(self):
        self._clear_auth()

        response = self.client.get("/api/report/orders/me/")

        self.assertIn(response.status_code, (401, 403))

    def test_admin_sales_history_includes_newly_registered_manual_sale(self):
        self._auth_admin()

        payload = {
            "customer_name": "Venta mostrador",
            "customer_phone": "3001234567",
            "status": "completed",
            "items": [{"product_id": self.product.id, "quantity": 3}],
        }

        create_response = self.client.post(
            "/api/admin/sales/register/",
            payload,
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        manual_order_id = create_response.data["id"]

        history_response = self.client.get(
            "/api/admin/sales/history/",
            {"order_source": "manual"},
        )

        self.assertEqual(history_response.status_code, 200)
        result_ids = [item["id"] for item in history_response.data["results"]]
        self.assertIn(manual_order_id, result_ids)

    def test_admin_sales_history_rejects_invalid_time_basis(self):
        self._auth_admin()

        response = self.client.get(
            "/api/admin/sales/history/",
            {"time_basis": "invalid"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("time_basis", response.data)

    def test_admin_sales_analysis_report_returns_summary_and_series(self):
        self._auth_admin()

        response = self.client.get(
            "/api/report/admin/sales/analysis/",
            {"group_by": "weekday", "range": "all"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("summary", response.data)
        self.assertIn("sales_series", response.data)
        self.assertIn("sales_chart_image", response.data)
        self.assertGreaterEqual(response.data["summary"]["total_orders"], 1)

    def test_sales_analysis_requires_admin_role(self):
        self._auth_customer()

        response = self.client.get(
            "/api/report/admin/sales/analysis/",
            {"group_by": "weekday", "range": "all"},
        )

        self.assertEqual(response.status_code, 403)
