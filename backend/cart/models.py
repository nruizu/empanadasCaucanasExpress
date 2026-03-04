from django.db import models

# Create your models here.


class CartProduct(models.Model):
    cart = models.ForeignKey(
        "Cart",
        on_delete=models.CASCADE,
        related_name="cart_products",
        related_query_name="cart_product",
    )
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self) -> str:
        return f"{self.quantity} of {self.product.name} in Cart {self.cart.id}"


class Cart(models.Model):
    user = models.ForeignKey(
        "auth.User",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="carts",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    products = models.ManyToManyField("catalog.Product", through=CartProduct)

    def __str__(self) -> str:
        return f"Cart {self.id}"
