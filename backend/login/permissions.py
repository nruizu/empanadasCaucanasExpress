from rest_framework.permissions import BasePermission

from .models import UserProfile
from .utils import get_user_profile


class IsCourierUser(BasePermission):
    message = "Solo los repartidores pueden acceder a este recurso."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        profile = get_user_profile(user)
        return bool(profile and profile.role == UserProfile.ROLE_COURIER)
