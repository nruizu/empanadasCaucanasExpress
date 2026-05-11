# Generated migration for OrderNotification model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0005_merge_20260415_1148"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrderNotification",
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
                (
                    "notification_type",
                    models.CharField(
                        choices=[
                            ("confirmation", "Confirmación de pedido"),
                            ("status_update", "Actualización de estado"),
                            ("delivery_reminder", "Recordatorio de entrega"),
                        ],
                        default="confirmation",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pendiente"),
                            ("sent", "Enviado"),
                            ("failed", "Fallido"),
                            ("skipped", "Omitido (no aplica)"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("phone_number", models.CharField(max_length=20)),
                (
                    "twilio_message_sid",
                    models.CharField(
                        blank=True,
                        help_text="ID del mensaje en Twilio",
                        max_length=255,
                        null=True,
                    ),
                ),
                (
                    "error_message",
                    models.TextField(blank=True, null=True),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to="catalog.order",
                    ),
                ),
            ],
            options={
                "verbose_name": "Notificación de Pedido",
                "verbose_name_plural": "Notificaciones de Pedido",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="ordernotification",
            index=models.Index(
                fields=["-created_at"],
                name="catalog_orde_created_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="ordernotification",
            index=models.Index(
                fields=["order", "status"],
                name="catalog_orde_order_id_status_idx",
            ),
        ),
    ]
