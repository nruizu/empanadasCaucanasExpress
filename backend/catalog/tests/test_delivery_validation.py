from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from backend.catalog.models import Order
from backend.catalog.services.delivery_geo import DeliveryValidationResult


class DeliveryValidationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("backend.catalog.views.validate_delivery_address")
    def test_prevalidation_endpoint_valid_response(self, mock_validate):
        mock_validate.return_value = DeliveryValidationResult(
            status="valid",
            message="Direccion valida y dentro de cobertura",
            latitude=Decimal("2.4450000"),
            longitude=Decimal("-76.6140000"),
            distance_km=Decimal("2.300"),
            maps_url="https://www.google.com/maps/dir/?api=1&destination=2.445,-76.614",
        )

        response = self.client.post(
            "/api/orders/delivery/validate/",
            {"delivery_address": "Calle 10 #20-30"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "valid")
        self.assertIn("delivery_maps_url", response.data)

    @patch("backend.catalog.serializers.validate_delivery_address")
    def test_create_delivery_order_persists_geo_fields(self, mock_validate):
        mock_validate.return_value = DeliveryValidationResult(
            status="valid",
            message="Direccion valida y dentro de cobertura",
            latitude=Decimal("2.4450000"),
            longitude=Decimal("-76.6140000"),
            distance_km=Decimal("2.300"),
            maps_url="https://www.google.com/maps/dir/?api=1&destination=2.445,-76.614",
        )

        payload = {
            "customer_name": "Cliente Delivery",
            "customer_phone": "3001111111",
            "delivery_method": "delivery",
            "delivery_address": "Calle 10 #20-30",
        }

        response = self.client.post("/api/orders/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.address_validation_status, "valid")
        self.assertEqual(order.delivery_latitude, Decimal("2.4450000"))
        self.assertEqual(order.delivery_longitude, Decimal("-76.6140000"))
        self.assertEqual(order.delivery_distance_km, Decimal("2.300"))
        self.assertTrue(order.delivery_maps_url)

    @patch("backend.catalog.serializers.validate_delivery_address")
    def test_create_delivery_order_rejects_out_of_coverage(self, mock_validate):
        mock_validate.return_value = DeliveryValidationResult(
            status="out_of_coverage",
            message="La direccion esta fuera de cobertura (12.100 km > 5.00 km)",
            latitude=Decimal("2.4450000"),
            longitude=Decimal("-76.6140000"),
            distance_km=Decimal("12.100"),
            maps_url="https://www.google.com/maps/dir/?api=1&destination=2.445,-76.614",
        )

        payload = {
            "customer_name": "Cliente Delivery",
            "customer_phone": "3001111111",
            "delivery_method": "delivery",
            "delivery_address": "Calle 10 #20-30",
        }

        response = self.client.post("/api/orders/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("delivery_address", response.data)

    @patch("backend.catalog.serializers.validate_delivery_address")
    def test_pickup_order_does_not_trigger_delivery_validation(self, mock_validate):
        payload = {
            "customer_name": "Cliente Pickup",
            "customer_phone": "3002222222",
            "delivery_method": "pickup",
            "pickup_date": timezone.now().date().isoformat(),
            "pickup_time": "10:00",
        }

        response = self.client.post("/api/orders/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        mock_validate.assert_not_called()
