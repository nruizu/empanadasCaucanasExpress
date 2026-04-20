# Generated migration for adding delivery address fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("login", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="delivery_local_address",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="delivery_city",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="delivery_region",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
