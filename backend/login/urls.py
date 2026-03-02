from django.urls import path
from .views import login_view, register_view

urlpatterns = [
    path("login/", login_view, name="api_login"),
    path("registro/", register_view, name="api_register"),
]
