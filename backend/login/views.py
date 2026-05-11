from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import UserProfile
from .serializers import (
    CourierSerializer,
    UserAccountUpdateSerializer,
    UserMeSerializer,
    UserRegistrationSerializer,
)
from .utils import get_user_profile


def _build_auth_response(user, token):
    profile = get_user_profile(user)
    return {
        "token": token.key,
        "user_id": user.id,
        "username": user.username,
        "is_staff": user.is_staff,
        "role": profile.role if profile else UserProfile.ROLE_CUSTOMER,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    # gets the data from the JSON transformed in a python dictionary
    # then the user is authenticated and a JSON response is returned
    # with the token and user info
    username = request.data.get("username")
    password = request.data.get("password")
    if username is None or password is None:
        return Response(
            {"error": "username and password required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {"error": "invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response(_build_auth_response(user, token))


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    # the data from the JSON is transformed in a python dictionary and validated
    # if the data is valid, a new user is created and a JSON response is returned
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            _build_auth_response(user, token),
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    user = request.user

    if request.method == "PATCH":
        serializer = UserAccountUpdateSerializer(
            instance=user,
            data=request.data,
            partial=True,
        )
        if serializer.is_valid():
            serializer.save()
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = UserMeSerializer(user).data
    return Response(data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_couriers_view(request):
    couriers = (
        User.objects.select_related("profile")
        .filter(profile__role=UserProfile.ROLE_COURIER)
        .order_by("profile__full_name", "username")
    )
    return Response(
        CourierSerializer(couriers, many=True).data, status=status.HTTP_200_OK
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminUser])
def admin_users_view(request, user_id=None):
    """
    GET: Listar todos los usuarios (clientes y repartidores)
    PATCH: Actualizar rol de un usuario específico
    """
    if request.method == "GET":
        users = (
            User.objects.select_related("profile")
            .exclude(is_staff=True)
            .order_by("profile__full_name", "username")
        )
        return Response(
            [
                {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "full_name": (
                        user.profile.full_name if hasattr(user, "profile") else ""
                    ),
                    "phone": user.profile.phone if hasattr(user, "profile") else "",
                    "role": (
                        user.profile.role
                        if hasattr(user, "profile")
                        else UserProfile.ROLE_CUSTOMER
                    ),
                }
                for user in users
            ],
            status=status.HTTP_200_OK,
        )

    if request.method == "PATCH" and user_id:
        try:
            user = User.objects.get(id=user_id)
            profile = get_user_profile(user)

            # Seguridad: roles de cliente/repartidor son exclusivos de cuentas no-admin.
            if user.is_staff or user.is_superuser:
                return Response(
                    {"error": "No se puede cambiar el rol de cuentas administradoras."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if profile is None:
                return Response(
                    {"error": "Usuario no tiene perfil"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            new_role = request.data.get("role")
            if new_role not in [UserProfile.ROLE_CUSTOMER, UserProfile.ROLE_COURIER]:
                return Response(
                    {"error": "Rol inválido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            profile.role = new_role
            profile.save()

            return Response(
                {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "full_name": profile.full_name,
                    "phone": profile.phone,
                    "role": profile.role,
                },
                status=status.HTTP_200_OK,
            )

        except User.DoesNotExist:
            return Response(
                {"error": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )
