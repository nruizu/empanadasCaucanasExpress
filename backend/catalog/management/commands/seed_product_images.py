from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from backend.catalog.models import Product

ALIASES = {
    "papita-rellena": "ppa_rellena",
    "papas-k-chips": "papas_k_chip",
    "palito-de-queso-x2": "palitos_queso",
    "galleta-choco-nuez": "galleta_chocolate",
    "galletas-de-corazon-paq": "galletas_corazon",
    "arepa-de-maiz": "arepa_maiz",
    "arepas-de-maiz": "arepa_maiz",
    "arepa-de-huevo": "arepa_huevo",
    "carimanola": "carimañola",
}

KEYWORD_FILE_MAP = {
    "chorizo": "chorizo.jpeg",
    "morcilla": "morcilla.jpeg",
    "chicharron": "chicharron.jpeg",
    "picada": "picada.jpeg",
    "cocada": "cocada.jpeg",
    "cocadas": "cocada.jpeg",
    "caucanitas": "caucanitas_x_12.jpeg",
    "caucanas": "caucanitas_x_12.jpeg",
    "arepa-de-huevo": "arepa_huevo.jpeg",
    "arepa-de-maiz": "arepa_maiz.jpg",
    "arepas-de-maiz": "arepa_maiz.jpg",
    "arepa-de-chocolo": "chocolo.jpeg",
    "arepas-de-chocolo": "chocolo.jpeg",
    "gaseosa": "gaseosas.jpeg",
    "jugo": "jugo_soda.jpeg",
    "soda": "jugo_soda.jpeg",
    "agua": "agua_botella.jpg",
    "cerveza": "cerveza.jpeg",
    "hatsu": "hatsu.jpeg",
    "matcha": "matcha.jpeg",
    "aromatica": "aromatica.jpeg",
    "infusion": "aromatica.jpeg",
    "chocolate": "chocolate.jpeg",
    "milo": "milo.jpg",
    "caucanita": "caucanitas_x_12.jpeg",
    "empanada": "empanada-caucana.jpeg",
    "pastelito": "palitos_queso.jpg",
    "latte": "latte_capuccino_mocaccino.jpg",
    "capuccino": "latte_capuccino_mocaccino.jpg",
    "capuchino": "latte_capuccino_mocaccino.jpg",
}


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def _find_file(images_dir: Path, base_name: str):
    for ext in ("jpg", "jpeg", "png", "webp", "avif"):
        candidate = images_dir / f"{base_name}.{ext}"
        if candidate.exists():
            return candidate
    return None


def _compact(value: str):
    return "".join(char for char in slugify(value) if char.isalnum())


def _normalize_product_slug(product_slug: str):
    prefixes = (
        "entradas-",
        "desayunos-",
        "comidas-",
        "bebidas-calientes-",
        "bebidas-frias-",
        "para-llevar-",
    )
    for prefix in prefixes:
        if product_slug.startswith(prefix):
            prefix_len = len(prefix)
            return product_slug[prefix_len:]
    return product_slug


def _keyword_fallback(slug_value: str, available_files):
    for keyword, filename in KEYWORD_FILE_MAP.items():
        if keyword in slug_value and filename in available_files:
            return filename
    return None


def run_seed_product_images(images_dir: str = "backend/catalog/seed_images"):
    images_path = Path(images_dir)
    if not images_path.exists() and images_dir:
        docker_path = Path("/app/backend/catalog/seed_images")
        if docker_path.exists():
            images_path = docker_path

    if not images_path.exists():
        print(f"No existe: {images_path}")
        return

    image_files = [
        path
        for path in images_path.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    compact_file_map = {_compact(path.stem): path for path in image_files}
    available_files = {path.name for path in image_files}

    loaded = 0
    missing = 0
    missing_slugs = []

    for product in Product.objects.all():
        candidate = None

        if candidate is None:
            candidate = _find_file(images_path, product.slug)

        if candidate is None:
            clean_slug = _normalize_product_slug(product.slug)
            candidate = _find_file(images_path, clean_slug)

        if candidate is None:
            product_name_slug = slugify(product.name)
            alias = ALIASES.get(product_name_slug, product_name_slug)
            candidate = _find_file(images_path, alias)

        if candidate is None:
            compact_keys = {
                _compact(product.slug),
                _compact(_normalize_product_slug(product.slug)),
                _compact(product.name),
            }
            for compact_key in compact_keys:
                if compact_key in compact_file_map:
                    candidate = compact_file_map[compact_key]
                    break

        if candidate is None:
            base_slug = _normalize_product_slug(product.slug)
            fallback_filename = _keyword_fallback(base_slug, available_files)
            if fallback_filename:
                candidate = images_path / fallback_filename

        is_hot_drink = product.slug.startswith("bebidas-calientes-")
        if candidate is None and is_hot_drink:
            if "te-" in product.slug:
                fallback_filename = "aromatica.jpeg"
            else:
                fallback_filename = "bebidaCaliente.jpg"
            if fallback_filename in available_files:
                candidate = images_path / fallback_filename

        if candidate is None:
            missing += 1
            missing_slugs.append(product.slug)
            continue

        with candidate.open("rb") as file_handle:
            product.image.save(candidate.name, File(file_handle), save=True)
        loaded += 1

    print(f"Seed completado. Cargadas={loaded}, sin archivo={missing}")
    if missing_slugs:
        print("Sin imagen:")
        for slug in missing_slugs:
            print(f"- {slug}")


class Command(BaseCommand):
    help = "Populate product image field by matching files in a directory"

    def add_arguments(self, parser):
        parser.add_argument(
            "images_dir",
            nargs="?",
            default="backend/catalog/seed_images",
            help="Path to the folder containing product image files",
        )

    def handle(self, *args, **options):
        images_dir = options.get("images_dir")
        self.stdout.write(f"Seeding images from {images_dir}")
        run_seed_product_images(images_dir=images_dir)
        self.stdout.write(self.style.SUCCESS("Image seed completed."))
