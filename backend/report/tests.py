from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from backend.catalog.models import Order


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
