from django.contrib import admin
from .models import (
    Category,
    Product,
    Order,
    OrderItem,
    OrderAvailabilityConfig,
    RestrictedDate,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    # Filter only active products to avoid showing discontinued items
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    # Generate a valid URL according the category name
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "is_featured", "is_active")
    list_filter = ("is_featured", "is_active", "category")
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer_name",
        "delivery_method",
        "status",
        "pickup_date",
        "pickup_time",
        "scheduled_date",
        "total_amount",
        "created_at",
    )
    list_filter = ("status", "delivery_method", "created_at")
    search_fields = ("customer_name", "customer_phone", "customer_email")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (
            "Información del Cliente",
            {"fields": ("customer_name", "customer_phone", "customer_email")},
        ),
        ("Detalles del Pedido", {"fields": ("delivery_method", "status", "notes")}),
        (
            "HU 4: Recogida en Sede",
            {"fields": ("pickup_date", "pickup_time"), "classes": ("collapse",)},
        ),
        (
            "HU 5: Programación Futura",
            {"fields": ("scheduled_date",), "classes": ("collapse",)},
        ),
        (
            "Entrega a Domicilio",
            {"fields": ("delivery_address",), "classes": ("collapse",)},
        ),
        ("Información Financiera", {"fields": ("total_amount",)}),
        (
            "Metadatos",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product", "quantity", "unit_price", "subtotal")
    list_filter = ("order__status",)
    search_fields = ("order__customer_name", "product__name")


@admin.register(OrderAvailabilityConfig)
class OrderAvailabilityConfigAdmin(admin.ModelAdmin):
    list_display = (
        "pickup_weekday_open",
        "pickup_weekday_close",
        "delivery_weekday_open",
        "delivery_weekday_close",
        "updated_at",
    )


@admin.register(RestrictedDate)
class RestrictedDateAdmin(admin.ModelAdmin):
    list_display = ("date", "applies_to", "is_active", "reason")
    list_filter = ("applies_to", "is_active")
    search_fields = ("reason",)
