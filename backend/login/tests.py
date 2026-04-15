from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework.authtoken.models import Token
from rest_framework import status

from backend.login.models import UserProfile


class LoginViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    # CA-LOGIN-01: El usuario puede iniciar sesión con credenciales válidas
    def test_login_success_returns_token_and_user_data(self):
        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertIn("user_id", response.data)
        self.assertIn("username", response.data)
        self.assertIn("is_staff", response.data)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(response.data["user_id"], self.user.id)
        self.assertFalse(response.data["is_staff"])

    def test_login_token_is_persisted_in_database(self):
        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = Token.objects.get(key=response.data["token"])
        self.assertEqual(token.user, self.user)

    def test_login_returns_existing_token(self):
        token1 = Token.objects.create(user=self.user)
        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["token"], token1.key)

    def test_login_admin_user_is_staff_true(self):
        User.objects.create_superuser(
            username="admin", email="admin@example.com", password="adminpass123"
        )
        data = {"username": "admin", "password": "adminpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_staff"])

    # CA-LOGIN-02: El sistema rechaza credenciales inválidas o incompletas
    def test_login_invalid_username_returns_401(self):
        """CA-LOGIN-02: Dado que el username no existe,
        cuando el usuario intenta iniciar sesión, debe recibir error 401."""
        data = {"username": "noexiste", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"], "invalid credentials")

    def test_login_wrong_password_returns_401(self):
        data = {"username": "testuser", "password": "wrongpassword"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"], "invalid credentials")

    def test_login_missing_username_returns_400(self):
        data = {"password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username and password required", response.data["error"])

    def test_login_missing_password_returns_400(self):
        data = {"username": "testuser"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username and password required", response.data["error"])

    # CA-LOGIN-03: El usuario puede cerrar sesión y su token queda invalidado
    def test_logout_success_deletes_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(user=self.user).exists())

    def test_token_invalid_after_logout(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.client.post("/api/auth/logout/")

        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_authentication(self):
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # CA-LOGIN-04: El usuario autenticado puede consultar su propia información
    def test_me_returns_own_user_data(self):
        """CA-LOGIN-04: Dado que el usuario está autenticado,
        cuando consulta /me/, debe recibir sus propios datos."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(response.data["user_id"], self.user.id)
        self.assertFalse(response.data["is_staff"])
        self.assertIn("email", response.data)
        self.assertIn("full_name", response.data)
        self.assertIn("phone", response.data)
        self.assertIn("address", response.data)

    def test_me_each_user_sees_only_own_data(self):
        user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="pass123"
        )
        token2 = Token.objects.create(user=user2)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response1 = self.client.get("/api/auth/me/")

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token2.key}")
        response2 = self.client.get("/api/auth/me/")

        self.assertEqual(response1.data["username"], "testuser")
        self.assertEqual(response2.data["username"], "user2")
        self.assertNotEqual(response1.data["user_id"], response2.data["user_id"])

    def test_me_requires_authentication(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_patch_updates_account_data(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        payload = {
            "email": "updated@example.com",
            "full_name": "Usuario Actualizado",
            "phone": "3009990000",
            "address": "Calle Actualizada # 1-2",
        }

        response = self.client.patch("/api/auth/me/", payload)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "updated@example.com")

        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.full_name, "Usuario Actualizado")
        self.assertEqual(profile.phone, "3009990000")
        self.assertEqual(profile.address, "Calle Actualizada # 1-2")

    # setUp helper para tests de logout y me
    @property
    def token(self):
        return Token.objects.get_or_create(user=self.user)[0]


class RegisterViewTest(APITestCase):

    def setUp(self):
        self.client = APIClient()

    # CA-REG-01: El usuario puede registrarse con username y contraseña
    def test_register_success_returns_token_and_user_data(self):
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertIn("user_id", response.data)
        self.assertIn("username", response.data)
        self.assertEqual(response.data["username"], "newuser")
        self.assertFalse(response.data["is_staff"])

    def test_register_creates_user_in_database(self):
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        self.client.post("/api/auth/registro/", data)

        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "newuser@example.com")

    def test_register_without_email_returns_400(self):
        data = {
            "username": "newuser",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_register_missing_username_returns_400(self):
        data = {
            "email": "test@example.com",
            "password": "testpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_password_returns_400(self):
        data = {
            "username": "newuser",
            "email": "test@example.com",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_full_name_returns_400(self):
        data = {
            "username": "newuser",
            "email": "test@example.com",
            "password": "newpass123",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("full_name", response.data)

    def test_register_missing_phone_returns_400(self):
        data = {
            "username": "newuser",
            "email": "test@example.com",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_register_missing_address_returns_400(self):
        data = {
            "username": "newuser",
            "email": "test@example.com",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("address", response.data)

    # CA-REG-02: No se permiten usernames duplicados
    def test_register_duplicate_username_returns_400(self):
        User.objects.create_user(
            username="existinguser", email="existing@example.com", password="pass123"
        )
        data = {
            "username": "existinguser",
            "email": "otro@example.com",
            "password": "newpass123",
            "full_name": "Otro Usuario",
            "phone": "3007654321",
            "address": "Cra 1 # 2-3",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email_is_allowed(self):
        User.objects.create_user(
            username="user1", email="duplicate@example.com", password="pass123"
        )
        data = {
            "username": "user2",
            "email": "duplicate@example.com",
            "password": "newpass123",
            "full_name": "Usuario Dos",
            "phone": "3007654321",
            "address": "Cra 1 # 2-3",
        }
        response = self.client.post("/api/auth/registro/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # CA-REG-03: La contraseña debe cumplir requisitos mínimos de seguridad
    def test_register_password_too_short_returns_400(self):
        data = {
            "username": "newuser",
            "email": "test@example.com",
            "password": "short",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    # CA-REG-04: Al registrarse, el usuario recibe un token para operar de inmediato
    def test_register_creates_and_returns_valid_token(self):
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        token = Token.objects.get(key=response.data["token"])
        self.assertEqual(token.user.username, "newuser")

    def test_register_creates_user_profile(self):
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
            "full_name": "Nuevo Usuario",
            "phone": "3001234567",
            "address": "Calle 10 # 20-30",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        profile = UserProfile.objects.get(user=user)
        self.assertEqual(profile.full_name, "Nuevo Usuario")
        self.assertEqual(profile.phone, "3001234567")
        self.assertEqual(profile.address, "Calle 10 # 20-30")
