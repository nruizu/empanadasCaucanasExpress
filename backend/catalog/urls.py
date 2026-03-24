from django.urls import path

from .views import (
    ActiveCategoryListView,
    ActiveProductListView,
    AdminProductDetailView,
    AdminProductListCreateView,
    CategoryProductListView,
    FeaturedProductListView,
    OrderListCreateView,
    OrderDetailView,
)

urlpatterns = [
    path("products/", ActiveProductListView.as_view(), name="product-list"),
    path(
        "products/featured/",
        FeaturedProductListView.as_view(),
        name="product-featured-list",
    ),
    path(
        "categories/",
        ActiveCategoryListView.as_view(),
        name="category-lis\
         t",
    ),
    path(
        "categories/<slug:slug>/products/",
        CategoryProductListView.as_view(),
        name="category-product-list",
    ),
    path(
        "admin/products/",
        AdminProductListCreateView.as_view(),
        name="admin-product-list-create",
    ),
    path(
        "admin/products/<int:pk>/",
        AdminProductDetailView.as_view(),
        name="admin-product-detail",
    ),
    path(
        "orders/",
        OrderListCreateView.as_view(),
        name="order-list-create",
    ),
    path(
        "orders/<int:pk>/",
        OrderDetailView.as_view(),
        name="order-detail",
    ),
]
