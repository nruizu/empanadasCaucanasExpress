from django.urls import path

from .views import (
    ActiveCategoryListView,
    ActiveProductListView,
    CategoryProductListView,
    FeaturedProductListView,
)

urlpatterns = [
    path("products/", ActiveProductListView.as_view(), name="product-list"),
    path(
        "products/featured/",
        FeaturedProductListView.as_view(),
        name="product-featured-list",
    ),
    path("categories/", ActiveCategoryListView.as_view(), name="category-lis\
         t"),
    path(
        "categories/<slug:slug>/products/",
        CategoryProductListView.as_view(),
        name="category-product-list",
    ),
]
