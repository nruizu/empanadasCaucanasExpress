from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from backend.catalog.models import Category, Product



@transaction.atomic
def run_seed_products():
    categories_data = [
        ("entradas", "Entradas"),
        ("desayunos", "Desayunos"),
        ("comidas", "Comidas"),
        ("bebidas-calientes", "Bebidas Calientes"),
        ("bebidas-frias", "Bebidas Frías"),
        ("para-llevar", "Para Llevar"),
    ]

    categories = {}
    for slug, name in categories_data:
        category, _ = Category.objects.update_or_create(
            slug=slug,
            defaults={"name": name, "is_active": True},
        )
        categories[slug] = category

    # (category_slug, name, price, is_active)
    products_data = [
        # Entradas
        ("entradas", "Empanada caucana", "4500", True),
        ("entradas", "Caucanita", "1700", True),
        ("entradas", "Caucanitas x12", "20000", True),
        (
            "entradas",
            (
                "Combo Caucano (Caucanitas, palitos de queso, pastel de "
                "pollo, papitas rellenas)"
            ),
            "40000",
            True,
        ),
        ("entradas", "Carimañola", "7000", True),
        ("entradas", "Palito de queso x2", "6000", True),
        ("entradas", "Pastelito de pollo", "3000", False),
        ("entradas", "Empanada de queso", "3000", True),
        ("entradas", "Arepa de huevo", "6000", True),
        ("entradas", "Papita rellena", "2000", True),
        ("entradas", "Papas K-Chips", "8000", True),
        ("entradas", "Mihajas", "9000", False),
        ("entradas", "Tufa", "5000", False),
        ("entradas", "Galletas de corazón (paq)", "13000", True),
        ("entradas", "Cocadas artesanales", "6000", True),
        ("entradas", "Galleta choco nuez", "6000", True),
        # Desayunos
        (
            "desayunos",
            ("Desayuno básico (Huevos, arepa con quesito, empanada caucana)"),
            "20000",
            True,
        ),
        (
            "desayunos",
            (
                "Desayuno completo (Huevos, arepa con quesito, empanada "
                "caucana y porción de morcilla, chorizo o chicharrón)"
            ),
            "30000",
            True,
        ),
        # Comidas
        (
            "comidas",
            "Combo (Chorizo de cerdo o pollo con arepa de chocolo)",
            "30000",
            True,
        ),
        (
            "comidas",
            ("Chorizo pollo/cerdo (Arepa de maíz/chocolo pequeña con queso)"),
            "27000",
            True,
        ),
        (
            "comidas",
            "Chorizo (Arepa de maíz o chocolo pequeña con queso)",
            "18000",
            True,
        ),
        ("comidas", "Chicharrón 140 g", "24000", True),
        ("comidas", "Chicharrón 160 g", "26000", True),
        ("comidas", "Chicharrón 180 g", "28000", True),
        ("comidas", "Morcilla 1/2 porción", "12000", True),
        (
            "comidas",
            (
                "Morcilla porción completa (Arepa de maíz o chocolo "
                "pequeña con queso)"
            ),
            "18000",
            True,
        ),
        ("comidas", "Libra de morcilla fría", "30000", True),
        (
            "comidas",
            (
                "Picada pequeña (Caucanitas, morcilla, chorizo, "
                "chicharrón, arepas de maíz)"
            ),
            "46000",
            True,
        ),
        ("comidas", "Picada 6–8 personas", "95000", True),
        ("comidas", "Arepa de chocolo", "16500", True),
        ("comidas", "Arepa de chocolo pequeña", "8000", True),
        ("comidas", "Arepa de maíz", "5000", True),
        # Bebidas calientes
        ("bebidas-calientes", "Tinto", "3500", True),
        ("bebidas-calientes", "Americano", "4500", True),
        ("bebidas-calientes", "Espresso", "4500", True),
        ("bebidas-calientes", "Latte pequeño", "6000", True),
        ("bebidas-calientes", "Latte grande", "7500", True),
        ("bebidas-calientes", "Capuchino", "8000", True),
        ("bebidas-calientes", "Mocaccino", "9000", True),
        ("bebidas-calientes", "Milo", "8000", True),
        (
            "bebidas-calientes",
            "Aromática frutos deshidratados",
            "8000",
            True,
        ),
        ("bebidas-calientes", "Aromática Bivaco", "4000", True),
        ("bebidas-calientes", "Infusión", "6000", True),
        ("bebidas-calientes", "Té matcha", "7500", True),
        ("bebidas-calientes", "Leche dorada", "7500", False),
        ("bebidas-calientes", "Té inglés", "7500", False),
        ("bebidas-calientes", "Té chai", "7500", True),
        ("bebidas-calientes", "Té verde", "6000", True),
        ("bebidas-calientes", "Chocolate en leche", "8500", True),
        ("bebidas-calientes", "Chocolate con quesito", "9500", True),
        ("bebidas-calientes", "Chocolate negro", "7500", True),
        # Bebidas frías
        ("bebidas-frias", "Capuchino frío", "8000", True),
        ("bebidas-frias", "Capuchino sabores", "8500", True),
        ("bebidas-frias", "Latte frío", "7500", True),
        ("bebidas-frias", "Latte saborizado", "8500", True),
        ("bebidas-frias", "Milo", "8000", True),
        ("bebidas-frias", "Jugo en agua", "7500", True),
        ("bebidas-frias", "Jugo en leche", "8500", True),
        ("bebidas-frias", "Soda saborizada", "12000", True),
        ("bebidas-frias", "Soda michelada", "8000", True),
        ("bebidas-frias", "Té Hatsu", "8000", True),
        ("bebidas-frias", "Agua 280 ml", "3000", True),
        ("bebidas-frias", "Agua 400 ml", "4000", True),
        ("bebidas-frias", "Agua saborizada", "3000", True),
        ("bebidas-frias", "Cerveza", "8000", True),
        ("bebidas-frias", "Cerveza michelada", "9000", True),
        ("bebidas-frias", "Soda Juniper", "8000", True),
        ("bebidas-frias", "Gaseosa pequeña", "4000", True),
        ("bebidas-frias", "Gaseosa mediana", "6500", True),
        # Para llevar
        ("para-llevar", "Chorizo", "29000", True),
        ("para-llevar", "Caucanas x10", "32000", True),
        ("para-llevar", "Caucanitas x12", "16000", True),
        ("para-llevar", "Libra de morcilla", "17000", True),
        ("para-llevar", "Arepas de chocolo", "16500", True),
        ("para-llevar", "Arepas de chocolo pequeña", "9000", True),
        ("para-llevar", "Arepas de maíz", "5000", True),
    ]

    processed = 0
    for category_slug, name, price, is_active in products_data:
        slug = f"{category_slug}-{slugify(name)}"

        Product.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": "",
                "price": Decimal(price),
                "category": categories[category_slug],
                "is_active": is_active,
                "is_featured": False,
            },
        )
        processed += 1

    print(f"Seed de catálogo completado. Productos procesados: {processed}")


class Command(BaseCommand):
    help = "Seed categories and products into the database"

    def handle(self, *args, **options):
        """Entry point for the management command."""
        self.stdout.write("Running catalog seed...")
        run_seed_products()
        self.stdout.write(self.style.SUCCESS("Catalog seed finished."))

