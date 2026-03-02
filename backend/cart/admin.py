
from django.contrib import admin
from .models import Cart, CartProduct

@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ["id", "created_at", "updated_at"]
    readonly_fields = ["created_at", "updated_at"]

@admin.register(CartProduct)
class CartProductAdmin(admin.ModelAdmin):
    list_display = ["id", "cart", "product", "quantity"]
    list_filter = ["cart", "product"]