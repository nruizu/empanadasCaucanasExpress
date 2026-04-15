from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .serializers import (
    UserAccountUpdateSerializer,
    UserMeSerializer,
    UserRegistrationSerializer,
)


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
    info = {
        "token": token.key,
        "user_id": user.id,
        "username": user.username,
        "is_staff": user.is_staff,
    }
    return Response(info)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    # the data from the JSON is transformed in a python dictionary and validated
    # if the data is valid, a new user is created and a JSON response is returned
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        info = {
            "token": token.key,
            "user_id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
        }
        return Response(
            info,
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
