from django.db import migrations


def should_be_featured(product_name: str) -> bool:
    name = product_name.lower()

    is_empanada_caucana = "empanada" in name and "caucan" in name
    is_chuzo_res_cerdo = "chuzo" in name and (
        "res" in name or "cerdo" in name or "pollo" in name
    )
    is_chorizo_cerdo = "chorizo" in name and ("cerdo" in name or "pollo" in name)
    is_chicharron_chocolo = "chicharr" in name or (
        "chocolo" in name and "chicharr" in name
    )
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


def set_featured_products(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")

    for product in Product.objects.all():
        if should_be_featured(product.name) and not product.is_featured:
            product.is_featured = True
            product.save(update_fields=["is_featured"])


def unset_featured_products(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")

    for product in Product.objects.all():
        if should_be_featured(product.name) and product.is_featured:
            product.is_featured = False
            product.save(update_fields=["is_featured"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0003_order_orderitem"),
    ]

    operations = [
        migrations.RunPython(set_featured_products, unset_featured_products),
    ]
