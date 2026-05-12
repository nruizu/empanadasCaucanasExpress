from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0011_order_assigned_courier"),
    ]

    operations = [
        migrations.CreateModel(
            name="ManualPaymentSettings",
            fields=[
                (
                    "singleton_id",
                    models.PositiveSmallIntegerField(
                        primary_key=True,
                        default=1,
                        editable=False,
                        serialize=False,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("bank_name", models.CharField(blank=True, max_length=120)),
                ("account_number", models.CharField(blank=True, max_length=60)),
                ("account_type", models.CharField(blank=True, max_length=60)),
                ("account_holder", models.CharField(blank=True, max_length=120)),
                ("transfer_key", models.CharField(blank=True, max_length=120)),
                (
                    "qr_image",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="payment_qr/",
                    ),
                ),
                ("instructions", models.TextField(blank=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuracion de pago manual",
                "verbose_name_plural": "Configuracion de pagos manuales",
            },
        ),
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("cash_on_delivery", "Pago contra entrega"),
                    ("transfer", "Transferencia"),
                ],
                default="cash_on_delivery",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("pending_payment", "Pendiente de pago"),
                    ("cash_on_delivery", "Pago contra entrega"),
                    ("pending_validation", "Pendiente de validacion"),
                    ("approved", "Pago aprobado"),
                    ("rejected", "Pago rechazado"),
                ],
                default="cash_on_delivery",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_receipt",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="payment_receipts/",
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_receipt_uploaded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
