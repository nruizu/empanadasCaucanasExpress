from django.test import TestCase
from django.utils import timezone
from datetime import timedelta, time
from django.core.exceptions import ValidationError
from unittest.mock import patch
from backend.catalog.models import Order, OrderAvailabilityConfig, RestrictedDate


class HU4_PickupOrderTests(TestCase):
    """
    HU 4: Programar pedido para recoger en sede
    """

    def test_crear_pedido_pickup_valido(self):
        """Debe permitir crear pedido con fecha y hora válida"""
        order = Order(
            customer_name="Juan",
            customer_phone="123456789",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(10, 0),  # 10 AM
        )
        order.full_clean()
        order.save()
        self.assertIsNotNone(order.id)

    def test_rechaza_horario_fuera_rango(self):
        """Debe rechazar horarios fuera de lunes-sábado 9 AM - 8 PM"""
        order = Order(
            customer_name="Juan",
            customer_phone="123456789",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(8, 30),  # Inválido lunes-sábado
        )
        with self.assertRaises(ValidationError):
            order.full_clean()

    def test_domingo_permiste_recogida_desde_8am(self):
        """Domingo debe permitir desde las 8 AM"""
        today = timezone.now().date()
        days_until_sunday = (6 - today.weekday()) % 7
        sunday = today + timedelta(days=days_until_sunday)

        order = Order(
            customer_name="Ana",
            customer_phone="123456789",
            delivery_method="pickup",
            pickup_date=sunday,
            pickup_time=time(8, 0),
        )
        order.full_clean()  # No debe fallar

    def test_requiere_fecha_y_hora(self):
        """Debe exigir fecha y hora en pickup"""
        order = Order(
            customer_name="Juan",
            customer_phone="123456789",
            delivery_method="pickup",
            # SIN fecha ni hora
        )
        with self.assertRaises(ValidationError):
            order.full_clean()

    def test_rechaza_telefono_con_letras(self):
        """El teléfono no debe aceptar letras"""
        order = Order(
            customer_name="Juan",
            customer_phone="312A18822",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(10, 0),
        )
        with self.assertRaises(ValidationError):
            order.full_clean()

    def test_registra_modalidad_pickup(self):
        """Debe guardarse como pickup"""
        order = Order.objects.create(
            customer_name="Juan",
            customer_phone="123456789",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(12, 0),
        )
        self.assertEqual(order.delivery_method, "pickup")


class HU5_ScheduledOrderTests(TestCase):
    """
    HU 5: Programar pedido para fecha futura
    """

    def test_crear_pedido_fecha_futura(self):
        """Debe permitir fecha futura"""
        future_date = timezone.now().date() + timedelta(days=1)
        order = Order(
            customer_name="Maria",
            customer_phone="987654321",
            delivery_method="scheduled",
            scheduled_date=future_date,
        )
        order.full_clean()
        order.save()
        self.assertIsNotNone(order.id)

    def test_rechaza_fecha_pasada(self):
        """Debe rechazar fechas pasadas"""
        past_date = timezone.now().date() - timedelta(days=1)
        order = Order(
            customer_name="Maria",
            customer_phone="987654321",
            delivery_method="scheduled",
            scheduled_date=past_date,
        )
        with self.assertRaises(ValidationError):
            order.full_clean()

    def test_fecha_hoy_es_valida(self):
        """Hoy debería ser válida"""
        today = timezone.now().date()
        order = Order(
            customer_name="Maria",
            customer_phone="987654321",
            delivery_method="scheduled",
            scheduled_date=today,
        )
        order.full_clean()  # NO debe fallar

    def test_registra_pedido_programado(self):
        """Debe guardarse como scheduled"""
        future_date = timezone.now().date() + timedelta(days=2)
        order = Order.objects.create(
            customer_name="Maria",
            customer_phone="987654321",
            delivery_method="scheduled",
            scheduled_date=future_date,
        )
        self.assertEqual(order.delivery_method, "scheduled")


class HU_DeliveryOrderTests(TestCase):
    """
    HU: Pedido a domicilio
    """

    @patch("backend.catalog.models.timezone.localtime")
    def test_delivery_valido_con_direccion(self, mock_localtime):
        """Debe permitir domicilio con dirección válida en horario permitido"""
        mock_localtime.return_value = timezone.datetime(2026, 4, 13, 10, 0)  # Lunes

        order = Order(
            customer_name="Carlos",
            customer_phone="987654321",
            delivery_method="delivery",
            delivery_address="Calle 10 # 20-30, El Retiro",
        )
        order.full_clean()
        order.save()

        self.assertEqual(order.delivery_method, "delivery")
        self.assertEqual(order.estimated_delivery_time, "45-60 minutos")

    @patch("backend.catalog.models.timezone.localtime")
    def test_delivery_rechaza_fuera_de_horario(self, mock_localtime):
        """Debe rechazar domicilio luego de las 7:30 PM"""
        mock_localtime.return_value = timezone.datetime(2026, 4, 14, 19, 45)  # Martes

        order = Order(
            customer_name="Carlos",
            customer_phone="987654321",
            delivery_method="delivery",
            delivery_address="Calle 10 # 20-30, El Retiro",
        )

        with self.assertRaises(ValidationError):
            order.full_clean()


class OrderAvailabilityConfigTests(TestCase):
    def test_pickup_restricted_date_blocks_order(self):
        target_date = timezone.now().date() + timedelta(days=1)
        RestrictedDate.objects.create(
            date=target_date,
            applies_to="pickup",
            reason="Mantenimiento en sede",
            is_active=True,
        )

        order = Order(
            customer_name="Luisa",
            customer_phone="3123456789",
            delivery_method="pickup",
            pickup_date=target_date,
            pickup_time=time(10, 0),
        )

        with self.assertRaises(ValidationError):
            order.full_clean()

    @patch("backend.catalog.models.timezone.localtime")
    def test_delivery_uses_configured_schedule(self, mock_localtime):
        config = OrderAvailabilityConfig.get_solo()
        config.delivery_weekday_open = time(10, 0)
        config.delivery_weekday_close = time(18, 0)
        config.save()

        mock_localtime.return_value = timezone.datetime(2026, 4, 14, 9, 30)  # Martes

        order = Order(
            customer_name="Carlos",
            customer_phone="987654321",
            delivery_method="delivery",
            delivery_address="Calle 10 # 20-30, El Retiro",
        )

        with self.assertRaises(ValidationError):
            order.full_clean()

    @patch("backend.catalog.models.timezone.localtime")
    def test_delivery_requiere_direccion_valida(self, mock_localtime):
        """Debe exigir dirección con texto y numeración"""
        mock_localtime.return_value = timezone.datetime(2026, 4, 14, 11, 0)

        order = Order(
            customer_name="Carlos",
            customer_phone="987654321",
            delivery_method="delivery",
            delivery_address="Retiro",
        )

        with self.assertRaises(ValidationError):
            order.full_clean()
