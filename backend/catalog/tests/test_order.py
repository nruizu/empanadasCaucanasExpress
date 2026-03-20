from django.test import TestCase
from django.utils import timezone
from datetime import timedelta, time
from django.core.exceptions import ValidationError
from backend.catalog.models import Order

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
        """Debe rechazar horarios fuera de 8 AM - 8 PM"""
        order = Order(
            customer_name="Juan",
            customer_phone="123456789",
            delivery_method="pickup",
            pickup_date=timezone.now().date(),
            pickup_time=time(22, 0),  # 10 PM ❌
        )

        with self.assertRaises(ValidationError):
            order.full_clean()

    def test_requiere_fecha_y_hora(self):
        """Debe exigir fecha y hora en pickup"""
        order = Order(
            customer_name="Juan",
            customer_phone="123456789",
            delivery_method="pickup",
            # SIN fecha ni hora ❌
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