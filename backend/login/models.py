from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    ROLE_CUSTOMER = "customer"
    ROLE_COURIER = "courier"
    ROLE_CHOICES = [
        (ROLE_CUSTOMER, "Cliente"),
        (ROLE_COURIER, "Repartidor"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_CUSTOMER,
    )
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    address = models.CharField(max_length=255)
    delivery_local_address = models.CharField(max_length=255, blank=True, default="")
    delivery_city = models.CharField(max_length=255, blank=True, default="")
    delivery_region = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return f"Profile({self.user.username})"
