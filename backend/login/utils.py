from .models import UserProfile


def get_user_profile(user):
    if not user:
        return None

    try:
        return user.profile
    except UserProfile.DoesNotExist:
        return None
