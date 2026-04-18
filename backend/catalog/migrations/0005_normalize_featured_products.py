from django.db import migrations


def should_be_featured(product_name: str) -> bool:
    name = product_name.lower()

    if "desayuno" in name:
        return False

    is_empanada_caucana = (
        ("empanada caucana" in name or "empanadas caucanas" in name)
    )
    is_chuzo_res_cerdo = "chuzo" in name and ("res" in name or "cerdo" in name)
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


def normalize_featured_products(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")

    for product in Product.objects.all():
        should_feature = should_be_featured(product.name)
        if product.is_featured != should_feature:
            product.is_featured = should_feature
            product.save(update_fields=["is_featured"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_set_featured_products"),
    ]

    operations = [
        migrations.RunPython(normalize_featured_products, noop_reverse),
    ]
