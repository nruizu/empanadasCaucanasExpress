from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    address = models.CharField(max_length=255)

    def __str__(self):
        return f"Profile({self.user.username})"
