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
        )

    # function that is called when the serializer's save() method is invoked
    # it creates a new user instance using the validated data
    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        phone = validated_data.pop("phone")
        address = validated_data.pop("address")

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
        )
        return user


class UserMeSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="id", read_only=True)
    full_name = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()

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


class UserAccountUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    full_name = serializers.CharField(required=False, max_length=255)
    phone = serializers.CharField(required=False, max_length=30)
    address = serializers.CharField(required=False, max_length=255)

    def update(self, instance, validated_data):
        profile, _ = UserProfile.objects.get_or_create(
            user=instance,
            defaults={"full_name": "", "phone": "", "address": ""},
        )

        email = validated_data.get("email")
        if email is not None:
            instance.email = email
            instance.save(update_fields=["email"])

        if "full_name" in validated_data:
            profile.full_name = validated_data["full_name"]
        if "phone" in validated_data:
            profile.phone = validated_data["phone"]
        if "address" in validated_data:
            profile.address = validated_data["address"]
        profile.save(update_fields=["full_name", "phone", "address"])

        return instance
