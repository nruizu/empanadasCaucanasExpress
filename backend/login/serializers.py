from django.contrib.auth.models import User
from rest_framework import serializers

from .models import UserProfile


class UserRegistrationSerializer(serializers.ModelSerializer):
    # password field is overwritten with two rules:
    # it should be write-only to prevent it from being returned in responses
    # and have a minimum length of 8 characters
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=True)
    full_name = serializers.CharField(write_only=True, max_length=255)
    phone = serializers.CharField(write_only=True, max_length=30)
    address = serializers.CharField(write_only=True, max_length=255)
    delivery_local_address = serializers.CharField(
        write_only=True, max_length=255, required=False, allow_blank=True
    )
    delivery_city = serializers.CharField(
        write_only=True, max_length=255, required=False, allow_blank=True
    )
    delivery_region = serializers.CharField(
        write_only=True, max_length=255, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "phone",
            "address",
            "delivery_local_address",
            "delivery_city",
            "delivery_region",
        )

    # function that is called when the serializer's save() method is invoked
    # it creates a new user instance using the validated data
    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        phone = validated_data.pop("phone")
        address = validated_data.pop("address")
        delivery_local_address = validated_data.pop("delivery_local_address", "")
        delivery_city = validated_data.pop("delivery_city", "")
        delivery_region = validated_data.pop("delivery_region", "")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )

        UserProfile.objects.create(
            user=user,
            full_name=full_name,
            phone=phone,
            address=address,
            delivery_local_address=delivery_local_address,
            delivery_city=delivery_city,
            delivery_region=delivery_region,
        )
        return user


class UserMeSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="id", read_only=True)
    full_name = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    delivery_local_address = serializers.SerializerMethodField()
    delivery_city = serializers.SerializerMethodField()
    delivery_region = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "user_id",
            "username",
            "email",
            "is_staff",
            "full_name",
            "phone",
            "address",
            "delivery_local_address",
            "delivery_city",
            "delivery_region",
        )

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.full_name if profile else ""

    def get_phone(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.phone if profile else ""

    def get_address(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.address if profile else ""

    def get_delivery_local_address(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.delivery_local_address if profile else ""

    def get_delivery_city(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.delivery_city if profile else ""

    def get_delivery_region(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.delivery_region if profile else ""


class UserAccountUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    full_name = serializers.CharField(required=False, max_length=255)
    phone = serializers.CharField(required=False, max_length=30)
    address = serializers.CharField(required=False, max_length=255)
    delivery_local_address = serializers.CharField(
        required=False, max_length=255, allow_blank=True
    )
    delivery_city = serializers.CharField(
        required=False, max_length=255, allow_blank=True
    )
    delivery_region = serializers.CharField(
        required=False, max_length=255, allow_blank=True
    )

    def update(self, instance, validated_data):
        profile, _ = UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                "full_name": "",
                "phone": "",
                "address": "",
                "delivery_local_address": "",
                "delivery_city": "",
                "delivery_region": "",
            },
        )

        email = validated_data.get("email")
        if email is not None:
            instance.email = email
            instance.save(update_fields=["email"])

        update_fields = []
        if "full_name" in validated_data:
            profile.full_name = validated_data["full_name"]
            update_fields.append("full_name")
        if "phone" in validated_data:
            profile.phone = validated_data["phone"]
            update_fields.append("phone")
        if "address" in validated_data:
            profile.address = validated_data["address"]
            update_fields.append("address")
        if "delivery_local_address" in validated_data:
            profile.delivery_local_address = validated_data["delivery_local_address"]
            update_fields.append("delivery_local_address")
        if "delivery_city" in validated_data:
            profile.delivery_city = validated_data["delivery_city"]
            update_fields.append("delivery_city")
        if "delivery_region" in validated_data:
            profile.delivery_region = validated_data["delivery_region"]
            update_fields.append("delivery_region")

        if update_fields:
            profile.save(update_fields=update_fields)

        return instance
