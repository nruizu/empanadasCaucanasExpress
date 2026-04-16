"""
Servicio de notificaciones por Twilio/WhatsApp
Maneja el envío de mensajes de confirmación de pedidos
"""

import os
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class TwilioNotificationService:
    """
    Servicio para enviar notificaciones por WhatsApp usando Twilio.
    Implementa singleton pattern para manejar una única instancia del cliente.
    """

    _instance = None
    _client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el cliente de Twilio si está disponible"""
        if self._client is None and self._has_twilio_credentials():
            try:
                from twilio.rest import Client

                account_sid = os.getenv("TWILIO_ACCOUNT_SID")
                auth_token = os.getenv("TWILIO_AUTH_TOKEN")
                self._client = Client(account_sid, auth_token)
                logger.info("Cliente Twilio inicializado correctamente")
            except ImportError:
                logger.warning(
                    "Twilio no está instalado. "
                    "Las notificaciones estarán deshabilitadas."
                )
            except Exception as e:
                logger.error(f"Error al inicializar Twilio: {e}")

    @staticmethod
    def _has_twilio_credentials() -> bool:
        """Verifica si existen las credenciales de Twilio en el entorno"""
        return all(
            [
                os.getenv("TWILIO_ACCOUNT_SID"),
                os.getenv("TWILIO_AUTH_TOKEN"),
                os.getenv("TWILIO_WHATSAPP_FROM"),
            ]
        )

    def send_order_confirmation(
        self,
        phone_number: str,
        order_id: int,
        customer_name: str,
        delivery_method: str,
        total_amount: float,
        pickup_date: Optional[str] = None,
        pickup_time: Optional[str] = None,
        scheduled_date: Optional[str] = None,
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Envía un mensaje de confirmación de pedido por WhatsApp.

        Args:
            phone_number (str): Número de teléfono del cliente
                (formato: +573001234567)
            order_id (int): ID del pedido
            customer_name (str): Nombre del cliente
            delivery_method (str): Modalidad de entrega
                (pickup, delivery, scheduled)
            total_amount (float): Monto total del pedido
            pickup_date (Optional[str]): Fecha de recogida (formato: YYYY-MM-DD)
            pickup_time (Optional[str]): Hora de recogida (formato: HH:MM)
            scheduled_date (Optional[str]): Fecha programada (formato: YYYY-MM-DD)

        Returns:
            Tuple[bool, Optional[str], Optional[str]]:
                (éxito, message_sid, error_message)
        """
        if not self._client:
            logger.warning(
                "Twilio no configurado. "
                f"No se envió notificación para pedido {order_id}"
            )
            return False, None, "Twilio no está configurado"

        try:
            # Normalizar número de teléfono (asegurar que empiece con +)
            phone_number = self._normalize_phone(phone_number)

            # Construir el mensaje según el tipo de entrega
            message_text = self._build_message(
                order_id=order_id,
                customer_name=customer_name,
                delivery_method=delivery_method,
                total_amount=total_amount,
                pickup_date=pickup_date,
                pickup_time=pickup_time,
                scheduled_date=scheduled_date,
            )

            # Enviar mensaje por WhatsApp
            whatsapp_from = os.getenv("TWILIO_WHATSAPP_FROM")
            message = self._client.messages.create(
                from_=f"whatsapp:{whatsapp_from}",
                body=message_text,
                to=f"whatsapp:{phone_number}",
            )

            logger.info(
                f"Notificación enviada para pedido {order_id}. "
                f"Message SID: {message.sid}"
            )
            return True, message.sid, None

        except Exception as e:
            error_message = f"Error enviando notificación: {str(e)}"
            logger.error(f"Error para pedido {order_id}: {error_message}")
            return False, None, error_message

    def send_order_status_update(
        self,
        phone_number: str,
        order_id: int,
        customer_name: str,
        status: str,
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """Envía actualización de estado por WhatsApp para estados clave."""
        if not self._client:
            logger.warning(
                "Twilio no configurado. "
                f"No se envió actualización para pedido {order_id}"
            )
            return False, None, "Twilio no está configurado"

        try:
            normalized_phone = self._normalize_phone(phone_number)
            message_text = self._build_status_update_message(
                order_id=order_id,
                customer_name=customer_name,
                status=status,
            )

            whatsapp_from = os.getenv("TWILIO_WHATSAPP_FROM")
            message = self._client.messages.create(
                from_=f"whatsapp:{whatsapp_from}",
                body=message_text,
                to=f"whatsapp:{normalized_phone}",
            )

            logger.info(
                f"Actualización de estado enviada para pedido {order_id}. "
                f"Message SID: {message.sid}"
            )
            return True, message.sid, None
        except Exception as e:
            error_message = f"Error enviando actualización de estado: {str(e)}"
            logger.error(f"Error para pedido {order_id}: {error_message}")
            return False, None, error_message

    def _normalize_phone(self, phone: str) -> str:
        """
        Normaliza un número de teléfono.
        Asume formato colombiano si no incluye el prefijo internacional.
        """
        # Remover espacios y caracteres especiales
        phone = (
            phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        )

        # Si no empieza con +, asumir que es un número colombiano
        if not phone.startswith("+"):
            # Si empieza con 57, agregarle el +
            if phone.startswith("57"):
                phone = "+" + phone
            else:
                # Si empieza con 3, agregarle +57
                if phone.startswith("3"):
                    phone = "+57" + phone
                else:
                    phone = "+57" + phone

        return phone

    def _build_message(
        self,
        order_id: int,
        customer_name: str,
        delivery_method: str,
        total_amount: float,
        pickup_date: Optional[str] = None,
        pickup_time: Optional[str] = None,
        scheduled_date: Optional[str] = None,
    ) -> str:
        """Construye el mensaje de confirmación según el tipo de entrega"""
        base_message = f"""¡Hola {customer_name}! 👋

Tu pedido ha sido confirmado exitosamente 🎉

📦 Número de pedido: #{order_id}
💰 Total: ${total_amount:,.0f}
✅ Estado: Pendiente"""

        if delivery_method == "pickup":
            delivery_info = f"""
📍 Tipo: Recoger en sede
📅 Fecha: {pickup_date}
🕐 Hora: {pickup_time}"""
        elif delivery_method == "scheduled":
            delivery_info = f"""
📍 Tipo: Programado
📅 Fecha: {scheduled_date}"""
        else:  # delivery
            delivery_info = """
📍 Tipo: Entrega a domicilio
⏱️ Nos contactaremos pronto para confirmar los detalles"""

        closing = """

Gracias por tu compra! Si tienes dudas, contáctanos.

Empanadas Caucanas Express 🤤"""

        return base_message + delivery_info + closing

    def _build_status_update_message(
        self,
        order_id: int,
        customer_name: str,
        status: str,
    ) -> str:
        """Construye mensaje para estados confirmación, preparación y listo."""
        status_map = {
            "confirmed": "Confirmado",
            "preparing": "En preparación",
            "ready": "Listo para entregar",
        }

        status_label = status_map.get(status, status)

        return f"""¡Hola {customer_name}! 👋

Tu pedido #{order_id} cambió de estado.

🔄 Nuevo estado: {status_label}

Gracias por pedir en Empanadas Caucanas Express 🤤"""

    def is_enabled(self) -> bool:
        """Verifica si el servicio de notificaciones está habilitado"""
        return self._client is not None or self._has_twilio_credentials()


# Singleton instance
notification_service = TwilioNotificationService()
