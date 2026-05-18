from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from backend.catalog.models import Category, Product


def should_be_featured(product_name: str) -> bool:
    name = product_name.lower()

    if "desayuno" in name:
        return False

    is_empanada_caucana = "empanada caucana" in name or "empanadas caucanas" in name
    is_chuzo_res_cerdo = "chuzo" in name and ("res" in name or "cerdo" in name)
    # Compatibilidad con el catálogo actual donde hay productos de chorizo pollo/cerdo.
    is_chorizo_cerdo = "chorizo" in name and ("cerdo" in name or "pollo" in name)
    is_chicharron_chocolo = "chicharr" in name
    is_picada = "picada" in name

    return any(
        [
            is_empanada_caucana,
            is_chuzo_res_cerdo,
            is_chorizo_cerdo,
            is_chicharron_chocolo,
            is_picada,
        ]
    )


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

    SLUG_OVERRIDES = {
        "entradas-combo-caucano-caucanitas-palitos-de-queso"
        "-pastel-de-pollo-papitas-rellenas": "Combo Caucano",
        "entradas-tufa": "Trufa",
        "desayunos-desayuno-basico-huevos-arepa-con-quesito"
        "-empanada-caucana": "Desayuno básico",
        "desayunos-desayuno-completo-huevos-arepa-con-quesito"
        "-empanada-caucana-y-porcion-de-morcilla-chorizo-o"
        "-chicharron": "Desayuno completo",
        "comidas-combo-chorizo-de-cerdo-o-pollo-con-arepa-de" "-chocolo": "Combo Chuzo",
        "comidas-chorizo-pollocerdo-arepa-de-maizchocolo"
        "-pequena-con-queso": "Chuzo pollo o cerdo",
        "comidas-chorizo-arepa-de-maiz-o-chocolo-pequena" "-con-queso": "Chorizo",
        "comidas-morcilla-porcion-completa-arepa-de-maiz"
        "-o-chocolo-pequena-con-queso": "Morcilla porción completa",
        "comidas-picada-pequena-caucanitas-morcilla-chorizo"
        "-chicharron-arepas-de-maiz": "Picada pequeña",
    }

    FEATURED_OVERRIDES = {
        "comidas-combo-chorizo-de-cerdo-o-pollo-con-arepa" "-de-chocolo": True,
    }

    DESCRIPTIONS = {
        "entradas-combo-caucano-caucanitas-palitos-de-queso"
        "-pastel-de-pollo-papitas-rellenas": (
            "Caucanitas, palitos de queso, pasteles de pollo y papitas rellenas"
        ),
        "desayunos-desayuno-basico-huevos-arepa-con-quesito"
        "-empanada-caucana": (
            "Huevos, arepa con quesito y empanada caucana (incluye bebida)"
        ),
        "desayunos-desayuno-completo-huevos-arepa-con-quesito"
        "-empanada-caucana-y-porcion-de-morcilla-chorizo-o"
        "-chicharron": (
            "Huevos, arepa con quesito, empanada caucana y porción de "
            "morcilla, chorizo o chicharrón (incluye bebida)"
        ),
        "comidas-combo-chorizo-de-cerdo-o-pollo-con-arepa-de"
        "-chocolo": "Chuzo de pollo o cerdo con arepa de chocolo",
        "comidas-picada-pequena-caucanitas-morcilla-chorizo"
        "-chicharron-arepas-de-maiz": (
            "Incluye caucanitas, morcilla, chorizo, chicharrón y arepa de mote"
        ),
        "comidas-picada-68-personas": (
            "Incluye caucanitas, morcilla, chorizo, chicharrón y arepa de mote"
        ),
        "para-llevar-chorizo": "Paquete de chorizos para llevar",
        "para-llevar-caucanitas-x12": "Paquete caucanitas x12 para llevar",
        "para-llevar-libra-de-morcilla": "Paquete libra de morcilla para llevar",
        "para-llevar-arepas-de-chocolo": "Paquete arepas de chocolo para llevar",
    }

    # (category_slug, name, price, is_active)
    products_data = [
        # Entradas
        ("entradas", "Empanada caucana", "4500", True),
        ("entradas", "Caucanita", "1700", True),
        ("entradas", "Caucanitas x12", "20000", True),
        ("entradas", "Combo Caucano", "40000", True),
        ("entradas", "Carimañola", "7000", True),
        ("entradas", "Palito de queso x2", "6000", True),
        ("entradas", "Pastelito de pollo", "3000", False),
        ("entradas", "Empanada de queso", "3000", True),
        ("entradas", "Arepa de huevo", "6000", True),
        ("entradas", "Papita rellena", "2000", True),
        ("entradas", "Papas K-Chips", "8000", True),
        ("entradas", "Mihojas", "9000", False),
        ("entradas", "Trufa", "5000", False),
        ("entradas", "Galletas de corazón (paq)", "13000", True),
        ("entradas", "Cocadas artesanales", "6000", True),
        ("entradas", "Galleta choco nuez", "6000", True),
        # Desayunos
        ("desayunos", "Desayuno básico", "20000", True),
        ("desayunos", "Desayuno completo", "30000", True),
        # Comidas
        ("comidas", "Combo Chuzo", "30000", True),
        ("comidas", "Chuzo pollo o cerdo", "27000", True),
        ("comidas", "Chorizo", "18000", True),
        ("comidas", "Chicharrón 140 g", "24000", True),
        ("comidas", "Chicharrón 160 g", "26000", True),
        ("comidas", "Chicharrón 180 g", "28000", True),
        ("comidas", "Morcilla 1/2 porción", "12000", True),
        ("comidas", "Morcilla porción completa", "18000", True),
        ("comidas", "Libra de morcilla fría", "30000", True),
        ("comidas", "Picada pequeña", "46000", True),
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
        ("bebidas-calientes", "Aromática frutos deshidratados", "8000", True),
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

        # Use slug override if the name changed in admin (so DB slug stays)
        for orig_slug, orig_name in SLUG_OVERRIDES.items():
            if name == orig_name:
                slug = orig_slug
                break

        is_featured = FEATURED_OVERRIDES.get(slug, should_be_featured(name))

        Product.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": DESCRIPTIONS.get(slug, ""),
                "price": Decimal(price),
                "category": categories[category_slug],
                "is_active": is_active,
                "is_featured": is_featured,
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
