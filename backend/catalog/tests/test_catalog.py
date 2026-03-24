from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from backend.catalog.models import Category, Product


class CatalogFullFlowTest(TestCase):
    GREEN = "\033[92m"
    RED = "\033[91m"
    RESET = "\033[0m"

    def setUp(self):
        self.client = APIClient()

        self.cat_entradas = Category.objects.create(
            name="Entradas",
            slug="entradas",
            is_active=True,
        )
        self.cat_para_llevar = Category.objects.create(
            name="Para Llevar",
            slug="para-llevar",
            is_active=True,
        )
        self.cat_inactiva = Category.objects.create(
            name="Inactiva",
            slug="inactiva",
            is_active=False,
        )

        self.prod_empanada = Product.objects.create(
            name="Empanada caucana",
            slug="entradas-empanada-caucana",
            description="Tradicional",
            price=Decimal("4500.00"),
            category=self.cat_entradas,
            is_active=True,
            is_featured=False,
        )
        self.prod_caucanita = Product.objects.create(
            name="Caucanita",
            slug="entradas-caucanita",
            description="Destacado",
            price=Decimal("1700.00"),
            category=self.cat_entradas,
            is_active=True,
            is_featured=True,
        )
        self.prod_chorizo_pack = Product.objects.create(
            name="Chorizo",
            slug="para-llevar-chorizo",
            description="Para llevar",
            price=Decimal("29000.00"),
            category=self.cat_para_llevar,
            is_active=True,
            is_featured=False,
        )

        Product.objects.create(
            name="Oculto",
            slug="entradas-oculto",
            description="No debe salir",
            price=Decimal("9999.00"),
            category=self.cat_entradas,
            is_active=False,
            is_featured=True,
        )
        Product.objects.create(
            name="Con categoria inactiva",
            slug="inactiva-producto",
            description="No debe salir",
            price=Decimal("5000.00"),
            category=self.cat_inactiva,
            is_active=True,
            is_featured=True,
        )

    def _run_step(self, step_number, title, callback):
        print(f"[CATALOGO] {step_number}/9 {title}...")
        try:
            callback()
        except Exception:
            print(f"{self.RED}❌ {title}{self.RESET}")
            raise

        print(f"{self.GREEN}✅ {title}{self.RESET}")

    def test_catalog_full_api_functionality(self):
        def step_1():
            categories_response = self.client.get("/api/categories/")
            self.assertEqual(categories_response.status_code, 200)
            item_slug = [item["slug"] for item in categories_response.data]
            category_slugs = item_slug
            self.assertIn("entradas", category_slugs)
            self.assertIn("para-llevar", category_slugs)
            self.assertNotIn("inactiva", category_slugs)

        self._run_step(1, "Verificando categorías activas disponibles", step_1)

        def step_2():
            products_response = self.client.get("/api/products/")
            self.assertEqual(products_response.status_code, 200)
            self.assertIn("results", products_response.data)
            product_slugs = []
            for item in products_response.data["results"]:
                product_slugs.append(item["slug"])
            self.assertIn(self.prod_empanada.slug, product_slugs)
            self.assertIn(self.prod_caucanita.slug, product_slugs)
            self.assertIn(self.prod_chorizo_pack.slug, product_slugs)
            self.assertNotIn("entradas-oculto", product_slugs)
            self.assertNotIn("inactiva-producto", product_slugs)

        step_message = "Verificando listado general de productos activos"
        self._run_step(2, step_message, step_2)

        def step_3():
            featured_response = self.client.get("/api/products/featured/")
            self.assertEqual(featured_response.status_code, 200)
            featured_slugs = [item["slug"] for item in featured_response.data]
            self.assertEqual(featured_slugs, [self.prod_caucanita.slug])

        step_message = "Verificando endpoint de productos destacados"
        self._run_step(3, step_message, step_3)

        def step_4():
            g_products = self.client.get("/api/categories/entradas/products/")
            by_category_response = g_products
            self.assertEqual(by_category_response.status_code, 200)
            by_category_slugs = [
                item["slug"] for item in by_category_response.data["results"]
            ]
            self.assertIn(self.prod_empanada.slug, by_category_slugs)
            self.assertIn(self.prod_caucanita.slug, by_category_slugs)
            self.assertNotIn(self.prod_chorizo_pack.slug, by_category_slugs)

        self._run_step(4, "Verificando productos por categoría activa", step_4)

        def step_5():
            by_category_inactive_response = self.client.get(
                "/api/categories/inactiva/products/"
            )
            self.assertEqual(by_category_inactive_response.status_code, 404)

        self._run_step(5, "Verificando 404 en categoría inactiva", step_5)

        def step_6():
            filter_category_response = self.client.get(
                "/api/products/",
                {"category": "para-llevar"},
            )
            self.assertEqual(filter_category_response.status_code, 200)
            filter_cat_slugs = []
            for item in filter_category_response.data["results"]:
                filter_cat_slugs.append(item["slug"])
            self.assertEqual(filter_cat_slugs, [self.prod_chorizo_pack.slug])

        self._run_step(6, "Verificando filtro por categoría", step_6)

        def step_7():
            filter_price_response = self.client.get(
                "/api/products/",
                {"min_price": 2000, "max_price": 5000},
            )
            self.assertEqual(filter_price_response.status_code, 200)
            filter_price_slugs = [
                item["slug"] for item in filter_price_response.data["results"]
            ]
            self.assertEqual(filter_price_slugs, [self.prod_empanada.slug])

        step_message = "Verificando filtro por rango de precios"
        self._run_step(7, step_message, step_7)

        def step_8():
            # Search product "caucanita"
            s_p = self.client.get("/api/products/", {"search": "caucanita"})
            search_response = s_p
            self.assertEqual(search_response.status_code, 200)
            search_slugs = []
            for item in search_response.data["results"]:
                search_slugs.append(item["slug"])
            self.assertEqual(search_slugs, [self.prod_caucanita.slug])

        self._run_step(8, "Verificando búsqueda por texto", step_8)

        def step_9():
            ordering_response = self.client.get(
                "/api/products/", {"ordering": "-price"}
            )
            self.assertEqual(ordering_response.status_code, 200)
            ordering_slugs = [
                item["slug"] for item in ordering_response.data["results"]
            ]
            self.assertEqual(ordering_slugs[0], self.prod_chorizo_pack.slug)

        step_message = "Verificando ordenamiento por precio descendente"
        self._run_step(9, step_message, step_9)

        print(f"{self.GREEN}✅ Flujo validado correctamente.{self.RESET}")
