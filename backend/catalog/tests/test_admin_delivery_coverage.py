from django.contrib.auth.models import User
from django.test import TestCase
from decimal import Decimal
from unittest.mock import patch
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from backend.catalog.models import DeliveryCoverageSettings


class AdminDeliveryCoverageSettingsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin_user = User.objects.create_user(
            username="admin_coverage",
            password="AdminPass123!",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        self.normal_user = User.objects.create_user(
            username="normal_coverage",
            password="NormalPass123!",
            is_staff=False,
        )
        self.normal_token = Token.objects.create(user=self.normal_user)

    def _auth_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def _auth_normal(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.normal_token.key}")

    def _clear_auth(self):
        self.client.credentials()

    def test_requires_admin_permissions(self):
        self._clear_auth()
        unauth_response = self.client.get("/api/admin/delivery-coverage/")
        self.assertIn(unauth_response.status_code, (401, 403))

        self._auth_normal()
        forbidden_response = self.client.get("/api/admin/delivery-coverage/")
        self.assertEqual(forbidden_response.status_code, 403)

    @patch("backend.catalog.serializers.geocode_address")
    def test_admin_can_create_and_update_coverage(self, mock_geocode):
        mock_geocode.return_value = (Decimal("6.2306000"), Decimal("-75.6011000"))
        self._auth_admin()

        create_payload = {
            "name": "Cobertura Medellin",
            "local_address": "Calle 20B #80-15",
            "local_city": "Medellin",
            "local_region": "Antioquia",
            "local_country": "Colombia",
            "local_reference": "Belen",
            "max_delivery_km": "20.00",
            "is_enabled": True,
            "coverage_note": "Configuracion inicial",
        }

        create_response = self.client.put(
            "/api/admin/delivery-coverage/",
            create_payload,
            format="json",
        )
        self.assertEqual(create_response.status_code, 200)
        self.assertIsNotNone(create_response.data["id"])
        self.assertEqual(create_response.data["name"], "Cobertura Medellin")
        self.assertEqual(create_response.data["local_address"], "Calle 20B #80-15")

        coverage = DeliveryCoverageSettings.objects.get(id=create_response.data["id"])
        self.assertEqual(str(coverage.max_delivery_km), "20.00")
        self.assertEqual(str(coverage.local_latitude), "6.2306000")
        self.assertEqual(str(coverage.local_longitude), "-75.6011000")

        update_response = self.client.put(
            "/api/admin/delivery-coverage/",
            {
                "id": coverage.id,
                "max_delivery_km": "25.00",
                "coverage_note": "Ajuste de radio",
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)

        coverage.refresh_from_db()
        self.assertEqual(str(coverage.max_delivery_km), "25.00")
        self.assertEqual(coverage.coverage_note, "Ajuste de radio")

    def test_admin_get_returns_last_saved_settings(self):
        self._auth_admin()

        DeliveryCoverageSettings.objects.create(
            name="Cobertura A",
            local_address="Calle 10 #20-30",
            local_city="Medellin",
            local_region="Antioquia",
            local_country="Colombia",
            local_latitude="6.2200000",
            local_longitude="-75.6000000",
            max_delivery_km="10.00",
            is_enabled=True,
            coverage_note="A",
        )
        latest = DeliveryCoverageSettings.objects.create(
            name="Cobertura B",
            local_address="Calle 30 #70-40",
            local_city="Medellin",
            local_region="Antioquia",
            local_country="Colombia",
            local_latitude="6.2300000",
            local_longitude="-75.6100000",
            max_delivery_km="15.00",
            is_enabled=True,
            coverage_note="B",
        )

        response = self.client.get("/api/admin/delivery-coverage/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], latest.id)
        self.assertEqual(response.data["name"], "Cobertura B")

    @patch("backend.catalog.serializers.geocode_address")
    def test_admin_can_patch_partial_update(self, mock_geocode):
        mock_geocode.return_value = (Decimal("6.2306000"), Decimal("-75.6011000"))
        self._auth_admin()

        coverage = DeliveryCoverageSettings.objects.create(
            name="Cobertura Medellin",
            local_address="Calle 20B #80-15",
            local_city="Medellin",
            local_region="Antioquia",
            local_country="Colombia",
            local_latitude="6.2306000",
            local_longitude="-75.6011000",
            max_delivery_km="20.00",
            is_enabled=True,
        )

        response = self.client.patch(
            "/api/admin/delivery-coverage/",
            {
                "id": coverage.id,
                "max_delivery_km": "30.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        coverage.refresh_from_db()
        self.assertEqual(str(coverage.max_delivery_km), "30.00")

    @patch("backend.catalog.serializers.geocode_address")
    def test_admin_replaces_previous_coordinates_when_address_changes(
        self, mock_geocode
    ):
        mock_geocode.return_value = (Decimal("6.2400000"), Decimal("-75.6200000"))
        self._auth_admin()

        coverage = DeliveryCoverageSettings.objects.create(
            name="Cobertura Medellin",
            local_address="Calle 20B #80-15",
            local_city="Medellin",
            local_region="Antioquia",
            local_country="Colombia",
            local_latitude="6.2306000",
            local_longitude="-75.6011000",
            max_delivery_km="20.00",
            is_enabled=True,
        )

        response = self.client.patch(
            "/api/admin/delivery-coverage/",
            {
                "id": coverage.id,
                "local_address": "Carrera 80 #30-15",
                "local_city": "Medellin",
                "local_region": "Antioquia",
                "local_country": "Colombia",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        coverage.refresh_from_db()
        self.assertEqual(str(coverage.local_latitude), "6.2400000")
        self.assertEqual(str(coverage.local_longitude), "-75.6200000")
        mock_geocode.assert_called()

    def test_admin_returns_clear_errors_for_invalid_payload(self):
        self._auth_admin()

        response = self.client.patch(
            "/api/admin/delivery-coverage/",
            {"name": "Solo nombre"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.data)
        self.assertIn("errors", response.data)
