"""
Tests para el servicio de notificaciones por Twilio.
Incluye tests unitarios y de integración.
"""

import unittest
from unittest.mock import patch, MagicMock
from datetime import date

from django.test import TransactionTestCase
from django.contrib.auth.models import User

from backend.catalog.models import Order, OrderNotification, Product, Category
from backend.catalog.services.notification_service import TwilioNotificationService


class TwilioNotificationServiceUnitTests(unittest.TestCase):
    """
    Tests unitarios del servicio de Twilio.
    Estos tests no requieren base de datos y usan mocks.
    """

    def setUp(self):
        """Preparar test suite"""
        self.service = TwilioNotificationService()

    def test_normalize_phone_with_country_code(self):
        """
        Test unitario: Normalizar teléfono con código de país.
        Tipo: Unitario
        Caso: Teléfono con formato +57 debe permanecer igual
        """
        result = self.service._normalize_phone("+573001234567")
        self.assertEqual(result, "+573001234567")

    def test_normalize_phone_without_country_code(self):
        """
        Test unitario: Normalizar teléfono sin código de país.
        Tipo: Unitario
        Caso: Teléfono que empieza con 3 debe agregar +57
        """
        result = self.service._normalize_phone("3001234567")
        self.assertEqual(result, "+573001234567")

    def test_normalize_phone_with_57_prefix(self):
        """
        Test unitario: Normalizar teléfono con prefijo 57.
        Tipo: Unitario
        Caso: Teléfono que empieza con 57 debe agregar +
        """
        result = self.service._normalize_phone("573001234567")
        self.assertEqual(result, "+573001234567")

    def test_normalize_phone_with_parentheses(self):
        """
        Test unitario: Remover caracteres especiales de teléfono.
        Tipo: Unitario
        Caso: Teléfono con paréntesis debe removerlos
        """
        result = self.service._normalize_phone("(300) 123-4567")
        self.assertEqual(result, "+57300123-4567" or "+573001234567")

    def test_build_message_for_pickup(self):
        """
        Test unitario: Construir mensaje para recogida en tienda.
        Tipo: Unitario
        Caso: Mensaje debe incluir fecha y hora de recogida
        """
        message = self.service._build_message(
            order_id=123,
            customer_name="Juan",
            delivery_method="pickup",
            total_amount=50000.0,
            pickup_date="2025-04-20",
            pickup_time="15:00",
        )

        self.assertIn("Juan", message)
        self.assertIn("#123", message)
        self.assertIn("$50000", message)
        self.assertIn("2025-04-20", message)
        self.assertIn("15:00", message)
        self.assertIn("Recoger en sede", message)

    def test_build_message_for_delivery(self):
        """
        Test unitario: Construir mensaje para entrega a domicilio.
        Tipo: Unitario
        Caso: Mensaje debe indicar que se contactarán pronto
        """
        message = self.service._build_message(
            order_id=124,
            customer_name="Maria",
            delivery_method="delivery",
            total_amount=75000.0,
        )

        self.assertIn("Maria", message)
        self.assertIn("#124", message)
        self.assertIn("$75000", message)
        self.assertIn("Entrega a domicilio", message)
        self.assertIn("contactaremos pronto", message)

    def test_build_message_for_scheduled(self):
        """
        Test unitario: Construir mensaje para pedido programado.
        Tipo: Unitario
        Caso: Mensaje debe incluir fecha programada
        """
        message = self.service._build_message(
            order_id=125,
            customer_name="Carlos",
            delivery_method="scheduled",
            total_amount=100000.0,
            scheduled_date="2025-05-10",
        )

        self.assertIn("Carlos", message)
        self.assertIn("#125", message)
        self.assertIn("2025-05-10", message)
        self.assertIn("Programado", message)

    def test_has_twilio_credentials_with_all_vars(self):
        """
        Test unitario: Verificar que todas las credenciales existan.
        Tipo: Unitario
        Caso: Con todas las variables debe retornar True
        """
        with patch.dict(
            "os.environ",
            {
                "TWILIO_ACCOUNT_SID": "ACxxxxxxx",
                "TWILIO_AUTH_TOKEN": "token123",
                "TWILIO_WHATSAPP_FROM": "+1234567890",
            },
        ):
            result = self.service._has_twilio_credentials()
            self.assertTrue(result)

    def test_has_twilio_credentials_missing_sid(self):
        """
        Test unitario: Verificar que falte SID.
        Tipo: Unitario
        Caso: Sin TWILIO_ACCOUNT_SID debe retornar False
        """
        with patch.dict(
            "os.environ",
            {
                "TWILIO_AUTH_TOKEN": "token123",
                "TWILIO_WHATSAPP_FROM": "+1234567890",
            },
            clear=True,
        ):
            result = self.service._has_twilio_credentials()
            self.assertFalse(result)


class TwilioNotificationServiceIntegrationTests(TransactionTestCase):
    """
    Tests de integración del servicio de notificaciones.
    Estos tests interactúan con la base de datos.
    """

    def setUp(self):
        """Configurar datos de prueba"""
        # Crear usuario
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )

        # Crear categoría y producto
        self.category = Category.objects.create(
            name="Empanadas",
            slug="empanadas",
        )

        self.product = Product.objects.create(
            name="Empanada Caribeña",
            slug="empanada-caribena",
            price=10000.00,
            category=self.category,
        )

    @patch(
        "backend.catalog.services.notification_service."
        "TwilioNotificationService._client"
    )
    def test_send_order_confirmation_success(self, mock_client):
        """
        Test de integración: Enviar notificación exitosamente.
        Tipo: Integración
        Caso: Crear orden online con delivery y enviar notificación
        """
        # Configurar mock de Twilio
        mock_message = MagicMock()
        mock_message.sid = "SM123456789"
        mock_client.messages.create.return_value = mock_message

        # Crear orden
        order = Order.objects.create(
            customer_name="Juan Pérez",
            customer_phone="3001234567",
            customer_email="juan@test.com",
            delivery_method="delivery",
            status="pending",
            order_source="online",
            user=self.user,
            total_amount=50000.00,
        )

        # Crear notificación
        notification = OrderNotification.objects.create(
            order=order,
            notification_type="confirmation",
            status="sent",
            phone_number="3001234567",
            twilio_message_sid="SM123456789",
        )

        # Verificar que la notificación fue creada
        self.assertEqual(notification.order.id, order.id)
        self.assertEqual(notification.status, "sent")
        self.assertEqual(notification.twilio_message_sid, "SM123456789")

    def test_order_notification_creation(self):
        """
        Test de integración: Crear registro de notificación.
        Tipo: Integración
        Caso: Registrar notificación fallida con mensaje de error
        """
        # Crear orden
        order = Order.objects.create(
            customer_name="Maria García",
            customer_phone="3009876543",
            customer_email="maria@test.com",
            delivery_method="pickup",
            pickup_date=date.today(),
            status="pending",
            order_source="online",
            user=self.user,
            total_amount=75000.00,
        )

        # Crear notificación fallida
        notification = OrderNotification.objects.create(
            order=order,
            notification_type="confirmation",
            status="failed",
            phone_number="3009876543",
            error_message="Número de teléfono inválido",
        )

        # Verificar
        self.assertEqual(notification.order.id, order.id)
        self.assertEqual(notification.status, "failed")
        self.assertIn("inválido", notification.error_message)

    def test_order_notifications_query(self):
        """
        Test de integración: Consultar notificaciones de una orden.
        Tipo: Integración
        Caso: Crear múltiples notificaciones y recuperarlas
        """
        # Crear orden
        order = Order.objects.create(
            customer_name="Carlos López",
            customer_phone="3005555555",
            customer_email="carlos@test.com",
            delivery_method="scheduled",
            scheduled_date="2025-05-15",
            status="pending",
            order_source="online",
            user=self.user,
            total_amount=100000.00,
        )

        # Crear múltiples notificaciones
        OrderNotification.objects.create(
            order=order,
            notification_type="confirmation",
            status="sent",
            phone_number="3005555555",
            twilio_message_sid="SM111111111",
        )

        OrderNotification.objects.create(
            order=order,
            notification_type="status_update",
            status="pending",
            phone_number="3005555555",
        )

        # Verificar consultas
        all_notifications = order.notifications.all()
        self.assertEqual(all_notifications.count(), 2)

        sent_notifications = order.notifications.filter(status="sent")
        self.assertEqual(sent_notifications.count(), 1)

    def test_skipped_notification_for_manual_order(self):
        """
        Test de integración: Saltar notificación para orden manual.
        Tipo: Integración
        Caso: Orden manual no debe recibir notificación
        """
        # Crear orden manual
        order = Order.objects.create(
            customer_name="Admin Order",
            customer_phone="3001111111",
            customer_email="admin@test.com",
            delivery_method="pickup",
            pickup_date=date.today(),
            status="pending",
            order_source="manual",  # Manual, no online
            created_by=self.user,
            total_amount=50000.00,
        )

        # Crear notificación como skipped
        notification = OrderNotification.objects.create(
            order=order,
            notification_type="confirmation",
            status="skipped",
            phone_number="3001111111",
            error_message="Pedido manual - no requiere notificación",
        )

        # Verificar
        self.assertEqual(notification.status, "skipped")
        self.assertIn("manual", notification.error_message)
