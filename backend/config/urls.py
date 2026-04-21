"""
URL configuration for config project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("backend.catalog.urls")),
    path("api/cart/", include("backend.cart.urls")),
    path("api/auth/", include("backend.login.urls")),
    path("api/admin/", include("backend.report.admin_urls")),
    path("api/report/", include("backend.report.urls")),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,  # ← CORREGIDO: indentación
    )
