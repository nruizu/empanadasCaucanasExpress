from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from backend.catalog.models import Product

DIRECT_MAP = {
    "bebidas-calientes-americano": "americano_cafe.jpeg",
    "bebidas-calientes-aromatica-bivaco": "aromatica_bitaco.webp",
    "bebidas-calientes-aromatica-frutos-deshidratados": "aromatica_frutos_deshidratados.jpeg",  # noqa: E501
    "bebidas-calientes-capuchino": "capuccino.jpeg",
    "bebidas-calientes-chocolate-con-quesito": "chocolate_quesito.jpg",
    "bebidas-calientes-chocolate-en-leche": "chocolate_leche.jpg",
    "bebidas-calientes-chocolate-negro": "chocolate_negro.jpeg",
    "bebidas-calientes-espresso": "espresso_cafe.jpg",
    "bebidas-calientes-infusion": "infusion.png",
    "bebidas-calientes-latte-grande": "latte_grande1.jpg",
    "bebidas-calientes-latte-pequeno": "latte_pequeno.avif",
    "bebidas-calientes-leche-dorada": "leche_dorada.jpeg",
    "bebidas-calientes-milo": "milo_caliente.png",
    "bebidas-calientes-mocaccino": "mocaccino.jpg",
    "bebidas-calientes-tinto": "tinto.png",
    "bebidas-calientes-te-chai": "te_chai.avif",
    "bebidas-calientes-te-ingles": "te_ingles.png",
    "bebidas-calientes-te-matcha": "matcha_calienrte.png",
    "bebidas-calientes-te-verde": "te_verde_1.png",
    "bebidas-frias-agua-280-ml": "agua_botella.jpg",
    "bebidas-frias-agua-400-ml": "agua_botella.jpg",
    "bebidas-frias-agua-saborizada": "agua_brisa.jpg",
    "bebidas-frias-capuchino-frio": "capuccino_frio.png",
    "bebidas-frias-capuchino-sabores": "capuchino_sabores.jpeg",
    "bebidas-frias-cerveza": "cervezas_botella.jpeg",
    "bebidas-frias-cerveza-michelada": "cerveza_michelada.jpeg",
    "bebidas-frias-gaseosa-mediana": "gaseosa_mediana.jpg",
    "bebidas-frias-gaseosa-pequena": "gaseosa_mini.webp",
    "bebidas-frias-jugo-en-agua": "jugo_agua.png",
    "bebidas-frias-jugo-en-leche": "jugo_en_leche.png",
    "bebidas-frias-latte-frio": "latte_frio.jpeg",
    "bebidas-frias-latte-saborizado": "latte_saborizado.avif",
    "bebidas-frias-milo": "milo_frio.jpg",
    "bebidas-frias-soda-juniper": "soda-juniper.png",
    "bebidas-frias-soda-michelada": "soda-michelada.png",
    "bebidas-frias-soda-saborizada": "soda-saborizada.jpeg",
    "bebidas-frias-te-hatsu": "te_hatsu.png",
    "comidas-arepa-de-chocolo": "arepa_chocolo.jpeg",
    "comidas-arepa-de-chocolo-pequena": "arepa_chocolo_pequeña.jpeg",
    "comidas-arepa-de-maiz": "arepa_maiz.jpg",
    "comidas-chicharron-140-g": "chicharron-140-g.jpeg",
    "comidas-chicharron-160-g": "chicharron-160-g.jpeg",
    "comidas-chicharron-180-g": "chicharron-180-g.jpeg",
    "comidas-chorizo-arepa-de-maiz-o-chocolo-pequena-con-queso": "chorizos.jpeg",
    "comidas-chorizo-pollocerdo-arepa-de-maizchocolo-pequena-con-queso": "chuzo_sencillo.jpeg",  # noqa: E501
    "comidas-combo-chorizo-de-cerdo-o-pollo-con-arepa-de-chocolo": "combo_chuzo_chocolo.jpeg",  # noqa: E501
    "comidas-libra-de-morcilla-fria": "libra-de-morcilla.jpeg",
    "comidas-morcilla-12-porcion": "morcilla_media_porcion.jpeg",
    "comidas-morcilla-porcion-completa-arepa-de-maiz-o-chocolo-pequena-con-queso": "morcilla_porcion_completa.jpeg",  # noqa: E501
    "comidas-picada-68-personas": "picada_6_8_personas.jpeg",
    "comidas-picada-pequena-caucanitas-morcilla-chorizo-chicharron-arepas-de-maiz": "picada_pequena.jpeg",  # noqa: E501
    "desayunos-desayuno-basico-huevos-arepa-con-quesito-empanada-caucana": "desayuno_sencillo.jpeg",  # noqa: E501
    "desayunos-desayuno-completo-huevos-arepa-con-quesito-empanada-caucana-y-porcion-de-morcilla-chorizo-o-chicharron": "desayuno_completo.jpeg",  # noqa: E501
    "entradas-arepa-de-huevo": "arepa_huevo.jpeg",
    "entradas-carimanola": "carimanola_image.jpeg",
    "entradas-caucanita": "caucanita.jpg",
    "entradas-caucanitas-x12": "caucanitas.jpg",
    "entradas-cocadas-artesanales": "cocadas.jpeg",
    "entradas-combo-caucano-caucanitas-palitos-de-queso-pastel-de-pollo-papitas-rellenas": "combo_caucanita_palitoqueso.jpeg",  # noqa: E501
    "entradas-empanada-caucana": "empanada_caucana.jpeg",
    "entradas-empanada-de-queso": "empanada_queso.jpeg",
    "entradas-galleta-choco-nuez": "galleta_coco_nuez.jpeg",
    "entradas-galletas-de-corazon-paq": "galletas_corazon.jpg",
    "entradas-mihojas": "mihojas.png",
    "entradas-palito-de-queso-x2": "palito_queso_x2.jpeg",
    "entradas-papas-k-chips": "papas-k-chips.png",
    "entradas-papita-rellena": "papita-rellena.png",
    "entradas-pastelito-de-pollo": "pastelitos_pollo.jpeg",
    "entradas-tufa": "trufa.png",
    "para-llevar-arepas-de-chocolo": "arepa_chocolo_paquete.png",
    "para-llevar-arepas-de-chocolo-pequena": "arepa_chocolo_pequeña_paquete.png",
    "para-llevar-arepas-de-maiz": "arepa_maiz_paquete.png",
    "para-llevar-caucanas-x10": "caucanitas_llevar_paquete.png",
    "para-llevar-caucanitas-x12": "caucanitas_llevar_paquete.png",
    "para-llevar-chorizo": "chorizo_llevar_paquete.jpeg",
    "para-llevar-libra-de-morcilla": "libra_morcilla_llevar_paquete.png",
}

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def run_seed_product_images(images_dir: str = "backend/catalog/seed_images"):
    images_path = Path(images_dir)
    if not images_path.exists() and images_dir:
        docker_path = Path("/app/backend/catalog/seed_images")
        if docker_path.exists():
            images_path = docker_path

    if not images_path.exists():
        print(f"No existe: {images_path}")
        return

    loaded = 0
    missing = 0
    missing_slugs = []

    for product in Product.objects.all():
        filename = DIRECT_MAP.get(product.slug)
        if not filename:
            missing += 1
            missing_slugs.append(product.slug)
            continue

        candidate = images_path / filename
        if not candidate.exists():
            missing += 1
            missing_slugs.append(f"{product.slug} (no existe {filename})")
            continue

        with candidate.open("rb") as file_handle:
            product.image.save(filename, File(file_handle), save=True)
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
