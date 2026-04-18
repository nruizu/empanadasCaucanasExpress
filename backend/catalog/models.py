from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import time
import re


class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True, max_length=140)
    image = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        # When the model is used, django order search by name
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True, max_length=180)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    category = models.ForeignKey(
        Category,
        related_name="products",
        on_delete=models.PROTECT,
    )
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        # When the model is used, django order search by name
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class OrderAvailabilityConfig(models.Model):
    """Configuración global de horarios y avisos de pedidos."""

    singleton_id = models.PositiveSmallIntegerField(
        primary_key=True,
        default=1,
        editable=False,
    )
    pickup_weekday_open = models.TimeField(default=time(9, 0))
    pickup_weekday_close = models.TimeField(default=time(20, 0))
    pickup_sunday_open = models.TimeField(default=time(8, 0))
    pickup_sunday_close = models.TimeField(default=time(20, 0))
    delivery_weekday_open = models.TimeField(default=time(9, 0))
    delivery_weekday_close = models.TimeField(default=time(19, 30))
    delivery_sunday_open = models.TimeField(default=time(8, 0))
    delivery_sunday_close = models.TimeField(default=time(19, 30))
    is_accepting_orders = models.BooleanField(default=True)
    order_notice = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de horarios"
        verbose_name_plural = "Configuración de horarios"

    def __str__(self):
        return "Configuración global de horarios"

    @classmethod
    def get_solo(cls):
        config, _ = cls.objects.get_or_create(singleton_id=1)
        return config


class RestrictedDate(models.Model):
    APPLIES_TO_CHOICES = [
        ("all", "Todas las modalidades"),
        ("pickup", "Recoger en sede"),
        ("delivery", "Domicilio"),
        ("scheduled", "Programado"),
    ]

    date = models.DateField()
    applies_to = models.CharField(max_length=20, choices=APPLIES_TO_CHOICES, default="all")
    reason = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]
        verbose_name = "Día restringido"
        verbose_name_plural = "Días restringidos"
        constraints = [
            models.UniqueConstraint(
                fields=["date", "applies_to"],
                name="catalog_restricted_date_unique_date_applies_to",
            )
        ]

    def __str__(self):
        return f"{self.date} ({self.applies_to})"


class Order(models.Model):
    """
    Modelo de Pedido/Orden
    """

    # Opciones para modalidad de entrega
    DELIVERY_CHOICES = [
        ("pickup", "Recoger en sede"),
        ("delivery", "Entrega a domicilio"),
        ("scheduled", "Programado"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pendiente"),
        ("confirmed", "Confirmado"),
        ("preparing", "En preparación"),
        ("ready", "Listo"),
        ("completed", "Completado"),
        ("cancelled", "Cancelado"),
    ]

    # Información básica
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    # Información del cliente
    customer_name = models.CharField(max_length=200)
    customer_phone = models.CharField(max_length=20)
    customer_email = models.EmailField(blank=True, null=True)

    # Modalidad de entrega
    delivery_method = models.CharField(
        max_length=20, choices=DELIVERY_CHOICES, default="pickup"
    )

    # HU 4: Campos para recogida en sede
    pickup_date = models.DateField(blank=True, null=True)
    pickup_time = models.TimeField(blank=True, null=True)

    # HU 5: Campo para pedidos programados
    scheduled_date = models.DateField(blank=True, null=True)

    # Dirección (si es delivery)
    delivery_address = models.TextField(blank=True, null=True)

    # Notas adicionales
    notes = models.TextField(blank=True, null=True)

    # Total del pedido
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"

    def __str__(self):
        return f"Pedido #{self.id} - {self.customer_name}"

    @staticmethod
    def _get_pickup_window(config: OrderAvailabilityConfig, weekday: int):
        if weekday == 6:
            return config.pickup_sunday_open, config.pickup_sunday_close
        return config.pickup_weekday_open, config.pickup_weekday_close

    @staticmethod
    def _get_delivery_window(config: OrderAvailabilityConfig, weekday: int):
        if weekday == 6:
            return config.delivery_sunday_open, config.delivery_sunday_close
        return config.delivery_weekday_open, config.delivery_weekday_close

    @staticmethod
    def _is_restricted_date(target_date, method: str):
        return RestrictedDate.objects.filter(
            date=target_date,
            is_active=True,
        ).filter(models.Q(applies_to="all") | models.Q(applies_to=method)).first()

    @property
    def estimated_delivery_time(self):
        if self.delivery_method != "delivery":
            return None
        return "45-60 minutos"

    def clean(self):
        """
        Validaciones personalizadas
        """
        super().clean()

        phone = (self.customer_phone or "").strip()
        if not re.fullmatch(r"\d{7,15}", phone):
            raise ValidationError(
                "El teléfono debe contener solo números (7 a 15 dígitos)"
            )

        config = OrderAvailabilityConfig.get_solo()
        now_local = timezone.localtime()

        if not config.is_accepting_orders:
            raise ValidationError("Los pedidos están temporalmente deshabilitados.")

        # Cierre global: si hoy está restringido para "all", no se permiten pedidos
        # en ninguna modalidad (pickup, delivery o scheduled).
        global_restriction_today = RestrictedDate.objects.filter(
            date=now_local.date(),
            is_active=True,
            applies_to="all",
        ).first()
        if global_restriction_today:
            reason = (
                f" Motivo: {global_restriction_today.reason}"
                if global_restriction_today.reason
                else ""
            )
            raise ValidationError(
                f"No hay servicio de pedidos para hoy.{reason}"
            )

        # HU 4: Validar horario de recogida en sede.
        # Lunes a sábado: 9:00 AM - 8:00 PM.
        # Domingo: 8:00 AM - 8:00 PM.
        if self.delivery_method == "pickup":
            if not self.pickup_date or not self.pickup_time:
                raise ValidationError("Debe especificar fecha y hora de recogida")

            restricted = self._is_restricted_date(self.pickup_date, "pickup")
            if restricted:
                reason = f" Motivo: {restricted.reason}" if restricted.reason else ""
                raise ValidationError(
                    f"No hay servicio de recogida en sede para la fecha seleccionada.{reason}"
                )

            opening_time, closing_time = self._get_pickup_window(
                config,
                self.pickup_date.weekday(),
            )

            if not (opening_time <= self.pickup_time <= closing_time):
                if self.pickup_date.weekday() == 6:
                    raise ValidationError(
                        "La recogida en sede el domingo está fuera del horario configurado"
                    )
                raise ValidationError(
                    "La recogida en sede de lunes a sábado está fuera del horario configurado"
                )

        # HU 5: Validar que la fecha programada sea futura
        if self.scheduled_date:
            if self.scheduled_date < timezone.now().date():
                raise ValidationError("La fecha programada debe ser una fecha futura")

            restricted = self._is_restricted_date(self.scheduled_date, "scheduled")
            if restricted:
                reason = f" Motivo: {restricted.reason}" if restricted.reason else ""
                raise ValidationError(
                    f"No se permiten pedidos programados para la fecha seleccionada.{reason}"
                )

        # HU Domicilio: validar dirección, modalidad y horario de operación.
        # Lunes a sábado: 9:00 AM - 7:30 PM.
        # Domingo: 8:00 AM - 7:30 PM.
        if self.delivery_method == "delivery":
            address = (self.delivery_address or "").strip()
            if not address:
                raise ValidationError("Debe ingresar una dirección para el domicilio")

            if len(address) < 10:
                raise ValidationError("La dirección de entrega es demasiado corta")

            if not re.search(r"\d", address) or not re.search(
                r"[A-Za-zÁÉÍÓÚáéíóúÑñ]", address
            ):
                raise ValidationError(
                    "La dirección de entrega debe incluir texto y numeración"
                )

            restricted = self._is_restricted_date(now_local.date(), "delivery")
            if restricted:
                reason = f" Motivo: {restricted.reason}" if restricted.reason else ""
                raise ValidationError(
                    f"No hay servicio de domicilio para hoy.{reason}"
                )

            opening_time, closing_time = self._get_delivery_window(
                config,
                now_local.weekday(),
            )
            now_time = now_local.time()

            if not (opening_time <= now_time <= closing_time):
                if now_local.weekday() == 6:
                    raise ValidationError(
                        "El domicilio del domingo está fuera del horario configurado"
                    )
                raise ValidationError(
                    "El domicilio de lunes a sábado está fuera del horario configurado"
                )


class OrderItem(models.Model):
    """
    Items/productos dentro de un pedido
    """

    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Item del Pedido"
        verbose_name_plural = "Items del Pedido"

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"

    @property
    def subtotal(self):
        """Calcula el subtotal del item"""
        return self.quantity * self.unit_price
