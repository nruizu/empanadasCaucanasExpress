from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .serializers import UserRegistrationSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
	username = request.data.get("username")
	password = request.data.get("password")
	if username is None or password is None:
		return Response({"error": "username and password required"}, status=status.HTTP_400_BAD_REQUEST)

	user = authenticate(request, username=username, password=password)
	if user is None:
		return Response({"error": "invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

	token, _ = Token.objects.get_or_create(user=user)
	return Response({"token": token.key, "user_id": user.id, "username": user.username})


@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """Create a new user account."""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user_id": user.id, "username": user.username}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)