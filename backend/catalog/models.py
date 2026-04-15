from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import time
from django.contrib.auth.models import User


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

    SOURCE_CHOICES = [
        ("online", "Online"),
        ("manual", "Manual"),
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

    # Trazabilidad del origen de la venta
    order_source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default="online",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_orders",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"

    def __str__(self):
        return f"Pedido #{self.id} - {self.customer_name}"

    def clean(self):
        """
        Validaciones personalizadas
        """
        super().clean()

        # HU 4: Validar horario de recogida en sede
        if self.delivery_method == "pickup" and self.pickup_time:
            # Horario de atención: 8:00 AM - 8:00 PM
            opening_time = time(8, 0)
            closing_time = time(20, 0)

            if not (opening_time <= self.pickup_time <= closing_time):
                raise ValidationError(
                    "La hora de recogida debe estar entre 8:00 AM y 8:00 PM"
                )

        # HU 5: Validar que la fecha programada sea futura
        if self.scheduled_date:
            if self.scheduled_date < timezone.now().date():
                raise ValidationError("La fecha programada debe ser una fecha futura")

        if self.delivery_method == "scheduled" and not self.scheduled_date:
            raise ValidationError(
                "Debe especificar fecha programada para pedidos futuros"
            )

        if self.delivery_method == "delivery" and not self.delivery_address:
            raise ValidationError("Debe especificar dirección para entrega a domicilio")

        # Validar que si es pickup, tenga fecha y hora
        if self.delivery_method == "pickup":
            if not self.pickup_date or not self.pickup_time:
                raise ValidationError("Debe especificar fecha y hora de recogida")


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
