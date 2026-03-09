from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework.authtoken.models import Token
from rest_framework import status
from decimal import Decimal

from backend.cart.models import Cart, CartProduct
from backend.catalog.models import Category, Product


class CartModelTest(TestCase):
    # Pruebas para el modelo Cart

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.category = Category.objects.create(name="Test Category", slug="test-category")

    def test_cart_creation(self):
        # Prueba que se crea un carrito correctamente
        cart = Cart.objects.create(user=self.user)
        self.assertIsNotNone(cart.id)
        self.assertEqual(cart.user, self.user)
        self.assertIsNotNone(cart.created_at)
        self.assertIsNotNone(cart.updated_at)

    def test_cart_str_representation(self):
        # Prueba la representación en string del carrito
        cart = Cart.objects.create(user=self.user)
        self.assertEqual(str(cart), f"Cart {cart.id}")

    def test_cart_products_relationship(self):
        # Prueba la relación muchos a muchos con productos
        product = Product.objects.create(
            name="Test Product",
            slug="test-product",
            price=Decimal("10.00"),
            category=self.category,
        )
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=product, quantity=2)

        self.assertEqual(cart.products.count(), 1)
        self.assertIn(product, cart.products.all())


class CartProductModelTest(TestCase):
    # Pruebas para el modelo CartProduct

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.category = Category.objects.create(name="Test Category", slug="test-category")
        self.product = Product.objects.create(
            name="Test Product",
            slug="test-product",
            price=Decimal("10.00"),
            category=self.category,
        )
        self.cart = Cart.objects.create(user=self.user)

    def test_cart_product_creation(self):
        # Prueba la creación de CartProduct
        cart_product = CartProduct.objects.create(
            cart=self.cart, product=self.product, quantity=5
        )
        self.assertIsNotNone(cart_product.id)
        self.assertEqual(cart_product.quantity, 5)
        self.assertEqual(cart_product.cart, self.cart)
        self.assertEqual(cart_product.product, self.product)

    def test_cart_product_default_quantity(self):
        # Prueba que la cantidad por defecto es 1
        cart_product = CartProduct.objects.create(
            cart=self.cart, product=self.product
        )
        self.assertEqual(cart_product.quantity, 1)

    def test_cart_product_str_representation(self):
        # Prueba la representación en string de CartProduct
        cart_product = CartProduct.objects.create(
            cart=self.cart, product=self.product, quantity=3
        )
        expected = f"3 of {self.product.name} in Cart {self.cart.id}"
        self.assertEqual(str(cart_product), expected)

    def test_cart_product_cascade_delete(self):
        # Prueba que CartProduct se elimina al eliminar el carrito
        cart_product = CartProduct.objects.create(
            cart=self.cart, product=self.product, quantity=2
        )
        cart_id = self.cart.id
        self.cart.delete()

        self.assertFalse(CartProduct.objects.filter(id=cart_product.id).exists())


class CartViewSetTest(APITestCase):
    # Pruebas para las vistas del carrito

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
        
        self.category = Category.objects.create(name="Test Category", slug="test-category")
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

    def test_authentication_required(self):
        # Prueba que se requiere autenticación
        response = self.client.get("/api/cart/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_cart_requires_authentication(self):
        # Prueba que my_cart requiere autenticación
        response = self.client.get("/api/cart/my_cart/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_product_requires_authentication(self):
        # Prueba que agregar producto requiere autenticación
        data = {"product_id": 1, "quantity": 1}
        response = self.client.post("/api/cart/add_product/", data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_quantity_requires_authentication(self):
        # Prueba que actualizar cantidad requiere autenticación
        data = {"cart_product_id": 1, "quantity": 5}
        response = self.client.patch("/api/cart/update_quantity/", data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_cart_creates_cart_if_not_exists(self):
        # Prueba que my_cart crea el carrito si no existe
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/cart/my_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Cart.objects.filter(user=self.user).exists())

    def test_my_cart_returns_existing_cart(self):
        # Prueba que my_cart retorna el carrito existente
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(
            cart=cart, product=self.product1, quantity=2
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/cart/my_cart/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], cart.id)
        self.assertEqual(len(response.data["products"]), 1)

    def test_create_cart(self):
        # Prueba la creación de un nuevo carrito por usuario autenticado
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post("/api/cart/create_cart/")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verificar que el carrito se creó para el usuario autenticado
        self.assertTrue(Cart.objects.filter(user=self.user).exists())
        cart = Cart.objects.get(user=self.user)
        self.assertEqual(response.data["id"], cart.id)

    def test_create_cart_without_authentication(self):
        # Prueba que no se puede crear un carrito sin autenticación
        response = self.client.post("/api/cart/create_cart/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_product_to_cart(self):
        # Prueba agregar un producto al carrito
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        data = {"product_id": self.product1.id, "quantity": 3}
        response = self.client.post("/api/cart/add_product/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 1)
        self.assertEqual(response.data["products"][0]["quantity"], 3)
        self.assertEqual(response.data["total_items"], 3)

    def test_add_product_missing_product_id(self):
        # Prueba agregar producto sin product_id
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        data = {"quantity": 3}
        response = self.client.post("/api/cart/add_product/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("product_id is required", response.data["error"])

    def test_add_product_invalid_quantity(self):
        # Prueba agregar producto con cantidad inválida
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        data = {"product_id": self.product1.id, "quantity": -1}
        response = self.client.post("/api/cart/add_product/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantity must be a positive integer", response.data["error"])

    def test_add_product_non_numeric_quantity(self):
        # Prueba agregar producto con cantidad no numérica
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        data = {"product_id": self.product1.id, "quantity": "abc"}
        response = self.client.post("/api/cart/add_product/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_multiple_products(self):
        # Prueba agregar múltiples productos al carrito
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        # Agregar primer producto
        response1 = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 2}
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Agregar segundo producto
        response2 = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product2.id, "quantity": 1}
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response2.data["products"]), 2)
        self.assertEqual(response2.data["total_items"], 3)

    def test_add_same_product_increases_quantity(self):
        # Prueba agregar el mismo producto varias veces aumenta la cantidad
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        # Agregar producto primera vez
        self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 2}
        )
        
        # Agregar el mismo producto
        response = self.client.post(
            "/api/cart/add_product/", {"product_id": self.product1.id, "quantity": 3}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["products"][0]["quantity"], 5)

    def test_remove_product_from_cart(self):
        # Prueba eliminar un producto del carrito
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        # Crear carrito con producto
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(
            cart=cart, product=self.product1, quantity=2
        )
        
        # Eliminar producto
        response = self.client.delete(
            f"/api/cart/{cart.id}/remove_product/",
            {"cart_product_id": cart_product.id},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 0)

    def test_remove_product_missing_id(self):
        # Prueba eliminar producto sin cart_product_id
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)
        
        response = self.client.delete(
            f"/api/cart/{cart.id}/remove_product/",
            {},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_remove_nonexistent_product(self):
        # Prueba eliminar un producto que no existe en el carrito
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        cart = Cart.objects.create(user=self.user)
        
        response = self.client.delete(
            f"/api/cart/{cart.id}/remove_product/",
            {"cart_product_id": 9999},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_clear_cart(self):
        # Prueba limpiar el carrito
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        # Crear carrito con productos
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=self.product1, quantity=2)
        CartProduct.objects.create(cart=cart, product=self.product2, quantity=1)
        
        response = self.client.delete(f"/api/cart/{cart.id}/clear_cart/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["products"]), 0)
        self.assertEqual(response.data["total_items"], 0)

    def test_update_quantity(self):
        # Prueba actualizar la cantidad de un producto
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        # Crear carrito con producto
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(
            cart=cart, product=self.product1, quantity=2
        )
        
        # Actualizar cantidad
        response = self.client.patch(
            "/api/cart/update_quantity/",
            {"cart_product_id": cart_product.id, "quantity": 5},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["products"][0]["quantity"], 5)

    def test_update_quantity_invalid(self):
        # Prueba actualizar cantidad con valor inválido
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        cart = Cart.objects.create(user=self.user)
        cart_product = CartProduct.objects.create(
            cart=cart, product=self.product1, quantity=2
        )
        
        response = self.client.patch(
            "/api/cart/update_quantity/",
            {"cart_product_id": cart_product.id, "quantity": 0},
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_queryset_filters_by_user(self):
        # Prueba que el queryset de CartViewSet filtra por usuario autenticado
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        # Crear carrito para el usuario actual
        cart1 = Cart.objects.create(user=self.user)
        # Crear carrito para otro usuario
        cart2 = Cart.objects.create(user=self.other_user)
        
        response = self.client.get("/api/cart/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # La respuesta está paginada, acceder a los resultados
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], cart1.id)

    def test_total_price_calculation(self):
        # Prueba el cálculo del precio total
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        
        cart = Cart.objects.create(user=self.user)
        CartProduct.objects.create(cart=cart, product=self.product1, quantity=2)  # 20.00
        CartProduct.objects.create(cart=cart, product=self.product2, quantity=3)  # 60.00
        
        response = self.client.get("/api/cart/my_cart/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Total debería ser 20*2 + 20*3 = 40 + 60 = 100
        self.assertEqual(float(response.data["total_price"]), 80.00)
