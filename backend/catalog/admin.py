from django.contrib import admin
from .models import Category, Product


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
