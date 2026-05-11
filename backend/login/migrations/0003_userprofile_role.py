from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("login", "0002_userprofile_delivery_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="role",
            field=models.CharField(
                choices=[("customer", "Cliente"), ("courier", "Repartidor")],
                default="customer",
                max_length=20,
            ),
        ),
    ]
