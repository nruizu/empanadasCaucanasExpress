from django.contrib.auth.models import User
from django.utils import timezone
from datetime import time

from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from rest_framework import status

from backend.login.models import UserProfile
from backend.catalog.models import Order


class CourierAssignmentTests(APITestCase):
    def setUp(self):
        # admin
        self.admin = User.objects.create_user(
            username="admin",
            password="adminpass",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin)

        # courier
        self.courier = User.objects.create_user(
            username="courier_user",
            password="courierpass",
        )
        UserProfile.objects.create(
            user=self.courier,
            role=UserProfile.ROLE_COURIER,
            full_name="Courier Test",
            phone="3001234567",
            address="Calle 1 # 1-1",
        )
        self.courier_token = Token.objects.create(user=self.courier)

        # another courier
        self.courier2 = User.objects.create_user(
            username="courier_two",
            password="courierpass2",
        )
        UserProfile.objects.create(
            user=self.courier2,
            role=UserProfile.ROLE_COURIER,
            full_name="Courier Two",
            phone="3002223333",
            address="Calle 2 # 2-2",
        )
        Token.objects.create(user=self.courier2)

        # customer
        self.customer = User.objects.create_user(
            username="customer_user",
            password="customerpass",
        )
        UserProfile.objects.create(
            user=self.customer,
            role=UserProfile.ROLE_CUSTOMER,
            full_name="Cliente Test",
            phone="3004445555",
            address="Calle 3 # 3-3",
        )
        self.customer_token = Token.objects.create(user=self.customer)

        # create a pickup order (valid for model validations)
        self.order = Order.objects.create(
            customer_name="Cliente Uno",
            customer_phone="3001234567",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(10, 0),
        )

    def test_admin_can_assign_order_to_courier(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")
        payload = {"assigned_courier": self.courier.id}
        response = self.client.patch(
            f"/api/orders/{self.order.id}/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.assigned_courier)
        self.assertEqual(self.order.assigned_courier.id, self.courier.id)

    def test_non_admin_cannot_assign_order(self):
        # customer tries to assign -> should be forbidden by view permissions
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.customer_token.key}")
        payload = {"assigned_courier": self.courier.id}
        response = self.client.patch(
            f"/api/orders/{self.order.id}/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CourierAssignedListTests(APITestCase):
    def setUp(self):
        # courier A
        self.courier = User.objects.create_user(
            username="courier_a",
            password="pass",
        )
        UserProfile.objects.create(
            user=self.courier,
            role=UserProfile.ROLE_COURIER,
            full_name="Courier A",
            phone="3001112222",
            address="Calle A",
        )
        self.courier_token = Token.objects.create(user=self.courier)

        # courier B
        self.courier_b = User.objects.create_user(
            username="courier_b",
            password="pass",
        )
        UserProfile.objects.create(
            user=self.courier_b,
            role=UserProfile.ROLE_COURIER,
            full_name="Courier B",
            phone="3003334444",
            address="Calle B",
        )
        Token.objects.create(user=self.courier_b)

        # create orders and assign one to courier A
        self.order_a = Order.objects.create(
            customer_name="Cliente A",
            customer_phone="3005556666",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(11, 0),
            assigned_courier=self.courier,
        )

        self.order_b = Order.objects.create(
            customer_name="Cliente B",
            customer_phone="3007778888",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(12, 0),
            assigned_courier=self.courier_b,
        )

    def test_courier_sees_only_their_assigned_orders(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.courier_token.key}")
        response = self.client.get("/api/orders/assigned/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data.get("results")
            if isinstance(response.data, dict)
            else response.data
        )
        ids = [item["id"] for item in results]
        self.assertIn(self.order_a.id, ids)
        self.assertNotIn(self.order_b.id, ids)

    def test_courier_cannot_see_orders_assigned_to_others(self):
        # courier B token should not see order_a
        token_b = Token.objects.get(user=self.courier_b)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token_b.key}")
        response = self.client.get("/api/orders/assigned/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data.get("results")
            if isinstance(response.data, dict)
            else response.data
        )
        ids = [item["id"] for item in results]
        self.assertIn(self.order_b.id, ids)
        self.assertNotIn(self.order_a.id, ids)
