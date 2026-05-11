from django.urls import path

from .views import (
    admin_couriers_view,
    admin_users_view,
    login_view,
    logout_view,
    me_view,
    register_view,
)

urlpatterns = [
    path("login/", login_view, name="api_login"),
    path("registro/", register_view, name="api_register"),
    path("logout/", logout_view, name="api_logout"),
    path("me/", me_view, name="api_me"),
    path("admin/couriers/", admin_couriers_view, name="api_admin_couriers"),
    path("admin/users/", admin_users_view, name="api_admin_users"),
    path("admin/users/<int:user_id>/", admin_users_view, name="api_admin_users_detail"),
]
