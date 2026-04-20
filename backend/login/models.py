from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    address = models.CharField(max_length=255)
    delivery_local_address = models.CharField(max_length=255, blank=True, default="")
    delivery_city = models.CharField(max_length=255, blank=True, default="")
    delivery_region = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return f"Profile({self.user.username})"
