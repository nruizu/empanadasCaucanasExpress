from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from backend.catalog.models import Category, Product


class GestionCatalogoAdminTest(TestCase):
    GREEN = "\033[92m"
    RED = "\033[91m"
    RESET = "\033[0m"

    def setUp(self):
        self.client = APIClient()

        self.category = Category.objects.create(
            name="Empanadas",
            slug="empanadas",
            is_active=True,
        )

        self.admin_user = User.objects.create_user(
            username="admin_hu",
            password="AdminPass123!",
            is_staff=True,
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        self.normal_user = User.objects.create_user(
            username="cliente_hu",
            password="ClientePass123!",
            is_staff=False,
        )
        self.normal_token = Token.objects.create(user=self.normal_user)

    def _auth_as_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def _auth_as_normal_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.normal_token.key}")

    def _clear_auth(self):
        self.client.credentials()

    def _run_step(self, step_number, total_steps, title, callback):
        print(f"[CATALOGO] {step_number}/{total_steps} {title}...")
        try:
            callback()
        except Exception:
            print(f"{self.RED}❌ {title}{self.RESET}")
            raise

        print(f"{self.GREEN}✅ {title}{self.RESET}")

    def test_admin_puede_gestionar_catalogo_y_refleja_cambios(self):
        self._auth_as_admin()

        state = {"product_id": None}

        def step_1_crear_producto_admin():
            create_payload = {
                "name": "Empanada de Pipián",
                "slug": "empanada-pipian",
                "description": "Receta tradicional caucana",
                "price": "4500.00",
                "category_id": self.category.id,
                "is_featured": True,
                "is_active": True,
            }

            create_response = self.client.post(
                "/api/admin/products/",
                create_payload,
                format="json",
            )
            self.assertEqual(create_response.status_code, 201)
            self.assertEqual(create_response.data["slug"], "empanada-pipian")
            self.assertEqual(create_response.data["category"]["slug"], "empanadas")
            state["product_id"] = create_response.data["id"]

        self._run_step(
            1,
            7,
            "Validando que el administrador puede crear productos",
            step_1_crear_producto_admin,
        )

        def step_2_reflejo_catalogo_cliente_despues_crear():
            catalog_after_create = self.client.get("/api/products/")
            self.assertEqual(catalog_after_create.status_code, 200)
            slugs_after_create = [
                item["slug"] for item in catalog_after_create.data["results"]
            ]
            self.assertIn("empanada-pipian", slugs_after_create)

        self._run_step(
            2,
            7,
            "Validando que el producto creado aparece en el catálogo público",
            step_2_reflejo_catalogo_cliente_despues_crear,
        )

        def step_3_editar_producto_admin():
            update_payload = {
                "name": "Empanada de Pipián Premium",
                "description": "Versión mejorada",
                "price": "5200.00",
                "category_id": self.category.id,
                "is_featured": False,
                "is_active": False,
            }
            update_response = self.client.patch(
                f"/api/admin/products/{state['product_id']}/",
                update_payload,
                format="json",
            )
            self.assertEqual(update_response.status_code, 200)

        self._run_step(
            3,
            7,
            "Validando que el administrador puede editar productos",
            step_3_editar_producto_admin,
        )

        def step_4_verificar_cambios_bd():
            updated_product = Product.objects.get(id=state["product_id"])
            self.assertEqual(updated_product.name, "Empanada de Pipián Premium")
            self.assertEqual(updated_product.price, Decimal("5200.00"))
            self.assertFalse(updated_product.is_featured)
            self.assertFalse(updated_product.is_active)

        self._run_step(
            4,
            7,
            "Validando persistencia de la edición en base de datos",
            step_4_verificar_cambios_bd,
        )

        def step_5_reflejo_catalogo_cliente_despues_editar():
            catalog_after_update = self.client.get("/api/products/")
            self.assertEqual(catalog_after_update.status_code, 200)
            slugs_after_update = [
                item["slug"] for item in catalog_after_update.data["results"]
            ]
            self.assertNotIn("empanada-pipian", slugs_after_update)

        self._run_step(
            5,
            7,
            "Validando que cambios de estado se reflejan en el catálogo público",
            step_5_reflejo_catalogo_cliente_despues_editar,
        )

        def step_6_eliminar_producto_admin():
            delete_response = self.client.delete(
                f"/api/admin/products/{state['product_id']}/"
            )
            self.assertEqual(delete_response.status_code, 204)

        self._run_step(
            6,
            7,
            "Validando que el administrador puede eliminar productos",
            step_6_eliminar_producto_admin,
        )

        def step_7_verificar_eliminacion_bd():
            self.assertFalse(Product.objects.filter(id=state["product_id"]).exists())

        self._run_step(
            7,
            7,
            "Validando eliminación definitiva del producto",
            step_7_verificar_eliminacion_bd,
        )

        print(f"{self.GREEN}✅ Flujo validado correctamente.{self.RESET}")

    def test_usuario_no_admin_no_puede_gestionar_catalogo(self):
        self._auth_as_normal_user()

        def step_1_bloqueo_no_admin():
            payload = {
                "name": "Intento no admin",
                "slug": "intento-no-admin",
                "description": "No debería crearse",
                "price": "1000.00",
                "category_id": self.category.id,
                "is_featured": False,
                "is_active": True,
            }

            response = self.client.post("/api/admin/products/", payload, format="json")
            self.assertEqual(response.status_code, 403)

        self._run_step(
            1,
            1,
            "Validando restricción para usuarios autenticados sin rol admin",
            step_1_bloqueo_no_admin,
        )

    def test_usuario_sin_autenticacion_no_puede_gestionar_catalogo(self):
        self._clear_auth()

        def step_1_bloqueo_anonimo():
            payload = {
                "name": "Intento anónimo",
                "slug": "intento-anonimo",
                "description": "No debería crearse",
                "price": "1000.00",
                "category_id": self.category.id,
                "is_featured": False,
                "is_active": True,
            }

            response = self.client.post("/api/admin/products/", payload, format="json")
            self.assertIn(response.status_code, (401, 403))

        self._run_step(
            1,
            1,
            "Validando restricción para usuarios no autenticados",
            step_1_bloqueo_anonimo,
        )
