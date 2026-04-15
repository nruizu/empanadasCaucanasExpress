from decimal import Decimal
from datetime import timedelta, time

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from backend.catalog.models import Category, Order, Product


class SalesHistoryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin_user = User.objects.create_user(
            username="admin_sales",
            password="AdminPass123!",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        self.normal_user = User.objects.create_user(
            username="normal_sales",
            password="NormalPass123!",
            is_staff=False,
        )
        self.normal_token = Token.objects.create(user=self.normal_user)

        today = timezone.now().date()

        self.order_pickup = Order.objects.create(
            customer_name="Ana",
            customer_phone="3001111111",
            customer_email="ana@example.com",
            delivery_method="pickup",
            pickup_date=today,
            pickup_time=time(10, 0),
            status="completed",
            total_amount=Decimal("18000.00"),
        )

        self.order_delivery = Order.objects.create(
            customer_name="Luis",
            customer_phone="3002222222",
            delivery_method="delivery",
            status="pending",
            delivery_address="Calle 10 #20-30",
            total_amount=Decimal("15000.00"),
        )

        self.order_scheduled = Order.objects.create(
            customer_name="Marta",
            customer_phone="3003333333",
            delivery_method="scheduled",
            scheduled_date=today + timedelta(days=2),
            status="confirmed",
            total_amount=Decimal("22000.00"),
        )

        old_created = timezone.now() - timedelta(days=7)
        Order.objects.filter(id=self.order_pickup.id).update(created_at=old_created)
        self.order_pickup.refresh_from_db()

        self.category = Category.objects.create(
            name="Ventas Manuales",
            slug="ventas-manuales",
            is_active=True,
        )
        self.product_a = Product.objects.create(
            name="Empanada tradicional",
            slug="empanada-tradicional",
            description="",
            price=Decimal("5000.00"),
            category=self.category,
            is_active=True,
        )
        self.product_b = Product.objects.create(
            name="Empanada premium",
            slug="empanada-premium",
            description="",
            price=Decimal("7000.00"),
            category=self.category,
            is_active=True,
        )

    def _auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def _auth_normal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.normal_token.key}")

    def _clear_auth(self):
        self.client.credentials()

    def test_sales_history_requires_admin_role(self):
        self._clear_auth()
        unauth_response = self.client.get("/api/admin/sales/history/")
        self.assertIn(unauth_response.status_code, (401, 403))

        self._auth_normal()
        forbidden_response = self.client.get("/api/admin/sales/history/")
        self.assertEqual(forbidden_response.status_code, 403)

    def test_sales_history_admin_can_filter_by_created_date_range(self):
        self._auth_admin()

        start_date = (timezone.now().date() - timedelta(days=1)).isoformat()
        end_date = timezone.now().date().isoformat()

        response = self.client.get(
            "/api/admin/sales/history/",
            {
                "time_basis": "created",
                "start_date": start_date,
                "end_date": end_date,
            },
        )

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]

        self.assertIn(self.order_delivery.id, ids)
        self.assertIn(self.order_scheduled.id, ids)
        self.assertNotIn(self.order_pickup.id, ids)

    def test_sales_history_admin_can_filter_by_service_date_range(self):
        self._auth_admin()

        start_date = timezone.now().date().isoformat()
        end_date = (timezone.now().date() + timedelta(days=1)).isoformat()

        response = self.client.get(
            "/api/admin/sales/history/",
            {
                "time_basis": "service",
                "start_date": start_date,
                "end_date": end_date,
            },
        )

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]

        self.assertIn(self.order_pickup.id, ids)
        self.assertIn(self.order_delivery.id, ids)
        self.assertNotIn(self.order_scheduled.id, ids)

    def test_sales_history_admin_can_filter_by_delivery_method(self):
        self._auth_admin()

        response = self.client.get(
            "/api/admin/sales/history/",
            {"delivery_method": "scheduled"},
        )

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        self.assertEqual(ids, [self.order_scheduled.id])

    def test_sales_metrics_returns_aggregates_and_breakdown(self):
        self._auth_admin()

        response = self.client.get("/api/admin/sales/metrics/")
        self.assertEqual(response.status_code, 200)

        self.assertEqual(response.data["total_orders"], 3)
        self.assertEqual(Decimal(response.data["total_sold"]), Decimal("55000.00"))
        self.assertEqual(
            Decimal(response.data["average_ticket"]).quantize(Decimal("0.01")),
            Decimal("18333.33"),
        )

        by_method = {
            item["delivery_method"]: {
                "total_orders": item["total_orders"],
                "total_sold": Decimal(item["total_sold"]),
            }
            for item in response.data["by_delivery_method"]
        }

        self.assertEqual(by_method["pickup"]["total_orders"], 1)
        self.assertEqual(by_method["delivery"]["total_orders"], 1)
        self.assertEqual(by_method["scheduled"]["total_orders"], 1)

        self.assertEqual(by_method["pickup"]["total_sold"], Decimal("18000.00"))
        self.assertEqual(by_method["delivery"]["total_sold"], Decimal("15000.00"))
        self.assertEqual(by_method["scheduled"]["total_sold"], Decimal("22000.00"))

    def test_sales_metrics_requires_admin_role(self):
        self._clear_auth()
        unauth_response = self.client.get("/api/admin/sales/metrics/")
        self.assertIn(unauth_response.status_code, (401, 403))

        self._auth_normal()
        forbidden_response = self.client.get("/api/admin/sales/metrics/")
        self.assertEqual(forbidden_response.status_code, 403)

    def test_orders_list_get_is_now_admin_only_but_post_remains_open(self):
        self._clear_auth()

        get_response = self.client.get("/api/orders/")
        self.assertIn(get_response.status_code, (401, 403))

        payload = {
            "customer_name": "Cliente publico",
            "customer_phone": "3004444444",
            "delivery_method": "pickup",
            "pickup_date": timezone.now().date().isoformat(),
            "pickup_time": "12:00",
            "notes": "pedido desde checkout",
        }
        post_response = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(post_response.status_code, 201)

    def test_sales_history_rejects_invalid_date_range(self):
        self._auth_admin()

        response = self.client.get(
            "/api/admin/sales/history/",
            {
                "start_date": timezone.now().date().isoformat(),
                "end_date": (timezone.now().date() - timedelta(days=1)).isoformat(),
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("end_date", response.data)

    def test_admin_can_register_manual_sale_with_items(self):
        self._auth_admin()

        payload = {
            "customer_name": "Venta mostrador",
            "customer_phone": "3009999999",
            "status": "completed",
            "notes": "Venta registrada por admin",
            "items": [
                {"product_id": self.product_a.id, "quantity": 2},
                {"product_id": self.product_b.id, "quantity": 1},
            ],
        }

        response = self.client.post(
            "/api/admin/sales/register/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.order_source, "manual")
        self.assertEqual(order.created_by_id, self.admin_user.id)
        self.assertEqual(order.total_amount, Decimal("17000.00"))
        self.assertEqual(order.items.count(), 2)

    def test_manual_sale_is_reflected_in_history_and_metrics(self):
        self._auth_admin()
        register_payload = {
            "customer_name": "Registro manual",
            "customer_phone": "3007777777",
            "status": "completed",
            "items": [
                {"product_id": self.product_a.id, "quantity": 3},
            ],
        }
        register_response = self.client.post(
            "/api/admin/sales/register/",
            register_payload,
            format="json",
        )
        self.assertEqual(register_response.status_code, 201)
        order_id = register_response.data["id"]

        history_response = self.client.get(
            "/api/admin/sales/history/",
            {"order_source": "manual"},
        )
        self.assertEqual(history_response.status_code, 200)
        history_ids = [item["id"] for item in history_response.data["results"]]
        self.assertIn(order_id, history_ids)

        metrics_response = self.client.get(
            "/api/admin/sales/metrics/",
            {"order_source": "manual"},
        )
        self.assertEqual(metrics_response.status_code, 200)
        self.assertEqual(metrics_response.data["total_orders"], 1)
        self.assertEqual(
            Decimal(metrics_response.data["total_sold"]),
            Decimal("15000.00"),
        )

    def test_manual_sale_registration_requires_admin(self):
        payload = {
            "customer_name": "Sin permisos",
            "customer_phone": "3006666666",
            "status": "completed",
            "items": [{"product_id": self.product_a.id, "quantity": 1}],
        }

        self._clear_auth()
        unauth_response = self.client.post(
            "/api/admin/sales/register/",
            payload,
            format="json",
        )
        self.assertIn(unauth_response.status_code, (401, 403))

        self._auth_normal()
        forbidden_response = self.client.post(
            "/api/admin/sales/register/",
            payload,
            format="json",
        )
        self.assertEqual(forbidden_response.status_code, 403)

    def test_manual_sale_requires_items(self):
        self._auth_admin()
        payload = {
            "customer_name": "Sin items",
            "customer_phone": "3005555555",
            "status": "completed",
            "items": [],
        }

        response = self.client.post(
            "/api/admin/sales/register/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("items", response.data)

    def test_manual_sale_rejects_duplicate_products(self):
        self._auth_admin()
        payload = {
            "customer_name": "Duplicados",
            "customer_phone": "3001231234",
            "status": "completed",
            "items": [
                {"product_id": self.product_a.id, "quantity": 1},
                {"product_id": self.product_a.id, "quantity": 2},
            ],
        }

        response = self.client.post(
            "/api/admin/sales/register/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("items", response.data)

    def test_order_post_delivery_requires_address(self):
        self._clear_auth()
        payload = {
            "customer_name": "Cliente domicilio",
            "customer_phone": "3004441122",
            "delivery_method": "delivery",
            "status": "pending",
        }

        response = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(response.status_code, 400)

    def test_admin_can_delete_manual_sale(self):
        self._auth_admin()
        create_payload = {
            "customer_name": "Eliminar manual",
            "customer_phone": "3008888888",
            "status": "completed",
            "items": [{"product_id": self.product_a.id, "quantity": 1}],
        }
        create_response = self.client.post(
            "/api/admin/sales/register/",
            create_payload,
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        order_id = create_response.data["id"]

        delete_response = self.client.delete(f"/api/admin/sales/{order_id}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Order.objects.filter(id=order_id).exists())

    def test_cannot_delete_non_manual_sale_through_admin_delete_endpoint(self):
        self._auth_admin()

        response = self.client.delete(f"/api/admin/sales/{self.order_delivery.id}/")
        self.assertEqual(response.status_code, 404)

    def test_manual_sale_delete_requires_admin(self):
        self._clear_auth()
        unauth_response = self.client.delete(
            f"/api/admin/sales/{self.order_pickup.id}/"
        )
        self.assertIn(unauth_response.status_code, (401, 403))

        self._auth_normal()
        forbidden_response = self.client.delete(
            f"/api/admin/sales/{self.order_pickup.id}/"
        )
        self.assertEqual(forbidden_response.status_code, 403)

    def test_order_post_scheduled_requires_date(self):
        self._clear_auth()
        payload = {
            "customer_name": "Cliente programado",
            "customer_phone": "3004441133",
            "delivery_method": "scheduled",
            "status": "pending",
        }

        response = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(response.status_code, 400)
