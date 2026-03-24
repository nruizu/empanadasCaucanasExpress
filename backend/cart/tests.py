from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework.authtoken.models import Token
from rest_framework import status
from decimal import Decimal

from backend.cart.models import Cart, CartProduct
from backend.catalog.models import Category, Product


class CartModelTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.category = Category.objects.create(
            name="Test Category", slug="test-category"
        )
        self.product = Product.objects.create(
            name="Test Product",
            slug="test-product",
            price=Decimal("10.00"),
            category=self.category,
        )

    def test_cart_persists_between_sessions(self):
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=self.product, quantity=2)

        # Simula que el carrito persiste aunque el usuario "navegue" (se reconsulte)
        cart_recuperado = Cart.objects.get(user=self.user)
        self.assertEqual(cart_recuperado.products.count(), 1)
        self.assertIn(self.product, cart_recuperado.products.all())

    def test_cart_product_cascade_delete(self):
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(
            cart=cart, product=self.product, quantity=2
        )
        cart.delete()
        self.assertFalse(CartProduct.objects.filter(id=cart_product.id).exists())

    def test_cart_product_default_quantity(self):
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(cart=cart, product=self.product)
        self.assertEqual(cart_product.quantity, 1)


class CartViewSetTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", email="other@example.com", password="otherpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.other_token = Token.objects.create(user=self.other_user)

        self.category = Category.objects.create(
            name="Test Category", slug="test-category"
        )
        self.product1 = Product.objects.create(
            name="Product 1",
            slug="product-1",
            price=Decimal("10.00"),
            category=self.category,
            is_active=True,
        )
        self.product2 = Product.objects.create(
            name="Product 2",
            slug="product-2",
            price=Decimal("20.00"),
            category=self.category,
            is_active=True,
        )

    # CA-CART-01: El cliente puede agregar uno o varios productos al carrito
    def test_add_single_product_to_cart(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        data = {"product_id": self.product1.id, "quantity": 3}
        response = self.client.post("/api/cart/add_product/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 1)
        self.assertEqual(response.data["products"][0]["quantity"], 3)

    def test_add_multiple_products_to_cart(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 2}
        )
        response = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product2.id, "quantity": 1}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 2)
        self.assertEqual(response.data["total_items"], 3)

    def test_add_same_product_accumulates_quantity(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 2}
        )
        response = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 3}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["products"][0]["quantity"], 5)

    def test_add_product_requires_authentication(self):
        data = {"product_id": self.product1.id, "quantity": 1}
        response = self.client.post("/api/cart/add_product/", data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_product_missing_product_id(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post("/api/cart/add_product/", {"quantity": 3})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("product_id is required", response.data["error"])

    def test_add_product_invalid_quantity(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": -1}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantity must be a positive integer", response.data["error"])

    # CA-CART-02: El carrito muestra nombre, cantidad y precio de cada producto
    def test_cart_shows_product_details(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 2}
        )
        response = self.client.get("/api/cart/my_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cart_product = response.data["products"][0]

        # La cantidad está en el nivel raíz del CartProduct
        self.assertIn("quantity", cart_product)
        self.assertEqual(cart_product["quantity"], 2)

        # El nombre y precio están anidados dentro de "product"
        self.assertIn("product", cart_product)
        product_detail = cart_product["product"]
        self.assertIn("name", product_detail)
        self.assertIn("price", product_detail)
        self.assertEqual(product_detail["name"], "Product 1")
        self.assertEqual(float(product_detail["price"]), 10.00)

    def test_update_product_quantity(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(
            cart=cart, product=self.product1, quantity=2
        )

        response = self.client.patch(
            "/api/cart/update_quantity/",
            {"cart_product_id": cart_product.id, "quantity": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["products"][0]["quantity"], 5)

    def test_update_quantity_requires_authentication(self):
        response = self.client.patch(
            "/api/cart/update_quantity/", {"cart_product_id": 1, "quantity": 5}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_remove_product_from_cart(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(
            cart=cart, product=self.product1, quantity=2
        )

        response = self.client.delete(
            f"/api/cart/{cart.id}/remove_product/",
            {"cart_product_id": cart_product.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 0)

    def test_remove_nonexistent_product(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)

        response = self.client.delete(
            f"/api/cart/{cart.id}/remove_product/",
            {"cart_product_id": 9999},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # CA-CART-03: El cliente puede ver el total del pedido
    def test_cart_shows_correct_total_price(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=self.product1, quantity=2)
        CartProduct.objects.create(cart=cart, product=self.product2, quantity=3)

        response = self.client.get("/api/cart/my_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_price", response.data)
        self.assertEqual(float(response.data["total_price"]), 80.00)

    def test_cart_shows_total_items(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 2}
        )
        response = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product2.id, "quantity": 1}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_items", response.data)
        self.assertEqual(response.data["total_items"], 3)

    def test_clear_cart_resets_total(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=self.product1, quantity=2)
        CartProduct.objects.create(cart=cart, product=self.product2, quantity=1)

        response = self.client.delete(f"/api/cart/{cart.id}/clear_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 0)
        self.assertEqual(response.data["total_items"], 0)

    # CA-CART-04: El carrito se mantiene mientras el cliente navega por el catálogo
    def test_my_cart_creates_cart_if_not_exists(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/cart/my_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Cart.objects.filter(user=self.user).exists())

    def test_my_cart_returns_existing_cart_with_products(self):
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=self.product1, quantity=2)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/cart/my_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], cart.id)
        self.assertEqual(len(response.data["products"]), 1)

    def test_cart_is_isolated_per_user(self):
        cart1 = Cart.objects.create(user=self.user)
        Cart.objects.create(user=self.other_user)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], cart1.id)

    def test_my_cart_requires_authentication(self):
        response = self.client.get("/api/cart/my_cart/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
