from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from backend.catalog.models import Order
from backend.login.models import UserProfile


class CourierAssignedOrdersTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.courier = user_model.objects.create_user(
            username="repartidor-courier-list",
            password="pass1234",
        )
        UserProfile.objects.create(
            user=self.courier,
            role=UserProfile.ROLE_COURIER,
            full_name="Repartidor Lista",
            phone="3005556677",
            address="Calle 50",
        )
        self.courier_token = Token.objects.create(user=self.courier)

        self.other_user = user_model.objects.create_user(
            username="cliente-otro-courier",
            password="pass1234",
        )

        self.assigned_order = Order.objects.create(
            customer_name="Pedido Asignado",
            customer_phone="3001112233",
            delivery_method="delivery",
            delivery_address="Calle 10 # 20-30, Popayan",
            status="ready",
            assigned_courier=self.courier,
            assigned_at=timezone.now(),
        )
        self.unassigned_order = Order.objects.create(
            customer_name="Pedido Sin Asignar",
            customer_phone="3001112234",
            delivery_method="delivery",
            delivery_address="Calle 11 # 21-31, Popayan",
            status="ready",
            user=self.other_user,
        )

    def test_courier_sees_only_assigned_orders(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.courier_token.key}")

        response = self.client.get("/api/orders/assigned/")

        self.assertEqual(response.status_code, 200)
        result_ids = [item["id"] for item in response.data["results"]]
        self.assertIn(self.assigned_order.id, result_ids)
        self.assertNotIn(self.unassigned_order.id, result_ids)

    def test_non_courier_is_rejected(self):
        user = get_user_model().objects.create_user(
            username="cliente-no-courier",
            password="pass1234",
        )
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = self.client.get("/api/orders/assigned/")

        self.assertEqual(response.status_code, 403)
