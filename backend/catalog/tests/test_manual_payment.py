from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from backend.catalog.models import Order


class ManualPaymentFlowTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="cliente-pago",
            password="pass1234",
        )
        self.user_token = Token.objects.create(user=self.user)

        self.admin = user_model.objects.create_user(
            username="admin-pago",
            password="pass1234",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin)

    def _auth_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

    def _auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def _create_pickup_order(self, payment_method="cash_on_delivery"):
        self._auth_user()
        payload = {
            "customer_name": "Juan Pago",
            "customer_phone": "3001234567",
            "delivery_method": "pickup",
            "pickup_date": timezone.now().date().isoformat(),
            "pickup_time": "11:00",
            "payment_method": payment_method,
        }
        response = self.client.post("/api/orders/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        return response.data

    def test_cash_on_delivery_sets_payment_status(self):
        data = self._create_pickup_order(payment_method="cash_on_delivery")
        self.assertEqual(data["payment_status"], "cash_on_delivery")

    def test_transfer_order_requires_receipt_upload(self):
        data = self._create_pickup_order(payment_method="transfer")
        order_id = data["id"]

        receipt = SimpleUploadedFile(
            "comprobante.png",
            b"fake-image-content",
            content_type="image/png",
        )

        upload_response = self.client.post(
            f"/api/orders/{order_id}/payment/receipt/",
            {"payment_receipt": receipt},
        )
        self.assertEqual(upload_response.status_code, 200)
        self.assertEqual(upload_response.data["payment_status"], "pending_validation")

    def test_transfer_receipt_rejects_invalid_file(self):
        data = self._create_pickup_order(payment_method="transfer")
        order_id = data["id"]

        receipt = SimpleUploadedFile(
            "comprobante.txt",
            b"invalid",
            content_type="text/plain",
        )

        upload_response = self.client.post(
            f"/api/orders/{order_id}/payment/receipt/",
            {"payment_receipt": receipt},
        )
        self.assertEqual(upload_response.status_code, 400)

    def test_admin_can_approve_manual_payment(self):
        data = self._create_pickup_order(payment_method="transfer")
        order_id = data["id"]

        receipt = SimpleUploadedFile(
            "comprobante.pdf",
            b"fake-pdf-content",
            content_type="application/pdf",
        )
        self.client.post(
            f"/api/orders/{order_id}/payment/receipt/",
            {"payment_receipt": receipt},
        )

        self._auth_admin()
        response = self.client.post(f"/api/orders/{order_id}/payment/approve/")
        self.assertEqual(response.status_code, 200)

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.payment_status, "approved")
        self.assertEqual(order.status, "confirmed")

    def test_admin_can_reject_manual_payment(self):
        data = self._create_pickup_order(payment_method="transfer")
        order_id = data["id"]

        receipt = SimpleUploadedFile(
            "comprobante.pdf",
            b"fake-pdf-content",
            content_type="application/pdf",
        )
        self.client.post(
            f"/api/orders/{order_id}/payment/receipt/",
            {"payment_receipt": receipt},
        )

        self._auth_admin()
        response = self.client.post(f"/api/orders/{order_id}/payment/reject/")
        self.assertEqual(response.status_code, 200)

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.payment_status, "rejected")
