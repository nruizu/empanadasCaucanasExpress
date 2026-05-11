from django.urls import path
from .views import login_view, me_view, register_view, logout_view

urlpatterns = [
    path("login/", login_view, name="api_login"),
    path("registro/", register_view, name="api_register"),
    path("logout/", logout_view, name="api_logout"),
    path("me/", me_view, name="api_me"),
]
