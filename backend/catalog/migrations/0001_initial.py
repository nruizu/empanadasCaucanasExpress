from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        # Creates two tables on the DB (category & product)
        migrations.CreateModel(
            name="Category",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=140, unique=True)),
                ("image", models.URLField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name_plural": "categories",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Product",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=160)),
                ("slug", models.SlugField(max_length=180, unique=True)),
                ("description", models.TextField(blank=True)),
                ("price", models.DecimalField(decimal_places=2, max_digits=10)
                 ),
                ("image", models.URLField(blank=True)),
                ("is_featured", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="products",
                        to="catalog.category"),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
    ]
