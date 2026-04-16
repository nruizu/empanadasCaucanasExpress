from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from backend.catalog.models import DeliveryCoverageSettings
from backend.catalog.services.delivery_geo import validate_delivery_address


class DeliveryCityRuleTests(TestCase):
    def setUp(self):
        DeliveryCoverageSettings.objects.create(
            name="Cobertura El Retiro",
            local_address="Calle 10 #20-30",
            local_city="El Retiro",
            local_region="Antioquia",
            local_country="Colombia",
            local_reference="Parque principal",
            local_latitude=Decimal("6.0600000"),
            local_longitude=Decimal("-75.5030000"),
            max_delivery_km=Decimal("20.00"),
            is_enabled=True,
        )

    @patch("backend.catalog.services.delivery_geo._geocode_with_nominatim")
    def test_rejects_address_from_different_city_even_if_geocodable(self, mock_geocode):
        result = validate_delivery_address(
            "Calle 20B #80-15, Medellin, Antioquia, Colombia"
        )

        self.assertEqual(result.status, "invalid")
        self.assertIn("El Retiro", result.message)
        mock_geocode.assert_not_called()

    @patch("backend.catalog.services.delivery_geo._geocode_with_nominatim")
    def test_accepts_address_when_city_matches_and_is_within_distance(
        self, mock_geocode
    ):
        mock_geocode.return_value = (Decimal("6.0550000"), Decimal("-75.5080000"))

        result = validate_delivery_address(
            "Calle 8 #18-22, El Retiro, Antioquia, Colombia"
        )

        self.assertEqual(result.status, "valid")
        self.assertIsNotNone(result.distance_km)
