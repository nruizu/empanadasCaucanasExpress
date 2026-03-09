from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from rest_framework.authtoken.models import Token
from rest_framework import status


class LoginViewTest(APITestCase):
    # Pruebas para la vista de login

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_login_success(self):
        # Prueba login exitoso con credenciales correctas
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

    def test_login_creates_token(self):
        # Prueba que el login crea un token si no existe o retorna el token existente
        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token_key = response.data["token"]

        # Verificar que el token existe en la base de datos
        # y está asociado al usuario correcto
        token = Token.objects.get(key=token_key)
        self.assertEqual(token.user, self.user)

    def test_login_invalid_username(self):
        # Prueba login con username inválido
        data = {"username": "invaliduser", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)
        self.assertEqual(response.data["error"], "invalid credentials")

    def test_login_invalid_password(self):
        # Prueba login con contraseña inválida
        data = {"username": "testuser", "password": "wrongpassword"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)
        self.assertEqual(response.data["error"], "invalid credentials")

    def test_login_missing_username(self):
        # Prueba login sin proporcionar username
        data = {"password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("username and password required", response.data["error"])

    def test_login_missing_password(self):
        # Prueba login sin proporcionar contraseña
        data = {"username": "testuser"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("username and password required", response.data["error"])

    def test_login_missing_both_credentials(self):
        # Prueba login sin proporcionar username ni contraseña
        data = {}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_returns_existing_token(self):
        # Prueba que login retorna token existente si ya existe
        token1 = Token.objects.create(user=self.user)

        data = {"username": "testuser", "password": "testpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["token"], token1.key)

    def test_login_admin_user(self):
        # Prueba login con usuario administrador
        User.objects.create_superuser(
            username="admin", email="admin@example.com", password="adminpass123"
        )

        data = {"username": "admin", "password": "adminpass123"}
        response = self.client.post("/api/auth/login/", data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_staff"])


class RegisterViewTest(APITestCase):
    # Pruebas para la vista de registro

    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        # Prueba registro exitoso con datos válidos
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertIn("user_id", response.data)
        self.assertIn("username", response.data)
        self.assertEqual(response.data["username"], "newuser")
        self.assertFalse(response.data["is_staff"])

    def test_register_creates_user(self):
        # Prueba que el registro crea un usuario en la BD
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "newuser@example.com")

    def test_register_creates_token(self):
        # Prueba que el registro crea un token para el nuevo usuario
        data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpass123",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        token_key = response.data["token"]
        token = Token.objects.get(key=token_key)
        self.assertEqual(token.user.username, "newuser")

    def test_register_duplicate_username(self):
        # Prueba registro con username duplicado (debería fallar)
        User.objects.create_user(
            username="existinguser", email="existing@example.com", password="pass123"
        )

        data = {
            "username": "existinguser",
            "email": "newemail@example.com",
            "password": "newpass123",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_username(self):
        # Prueba registro sin username
        data = {"email": "test@example.com", "password": "testpass123"}
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_password(self):
        # Prueba registro sin contraseña
        data = {"username": "newuser", "email": "test@example.com"}
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_password_too_short(self):
        # Prueba registro con contraseña muy corta
        data = {"username": "newuser", "email": "test@example.com", "password": "short"}
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_without_email(self):
        # Prueba registro sin email (campo opcional)
        data = {"username": "newuser", "password": "newpass123"}
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "")

    def test_register_empty_string_email(self):
        # Prueba registro con email vacío
        data = {"username": "newuser", "email": "", "password": "newpass123"}
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "")

    def test_register_duplicate_email(self):
        # Prueba registro con email duplicado (debería permitirse)
        User.objects.create_user(
            username="user1", email="duplicate@example.com", password="pass123"
        )

        data = {
            "username": "user2",
            "email": "duplicate@example.com",
            "password": "newpass123",
        }
        response = self.client.post("/api/auth/registro/", data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class LogoutViewTest(APITestCase):
    # Pruebas para la vista de logout

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)

    def test_logout_success(self):
        # Prueba logout exitoso con token válido
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

    def test_logout_deletes_token(self):
        # Prueba que el logout elimina el token de la base de datos
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(user=self.user).exists())

    def test_logout_without_authentication(self):
        # Prueba logout sin proporcionar token de autenticación
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_with_invalid_token(self):
        # Prueba logout con token inválido
        self.client.credentials(HTTP_AUTHORIZATION="Token invalidtoken")
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_use_token_after_logout(self):
        # Prueba que no se puede usar el token después de logout
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        # Logout
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Intentar usar el mismo token
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MeViewTest(APITestCase):
    # Pruebas para la vista me (información del usuario actual)

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="adminpass123"
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

    def test_me_success(self):
        # Prueba obtener información del usuario actual con token válido
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(response.data["user_id"], self.user.id)
        self.assertFalse(response.data["is_staff"])

    def test_me_returns_correct_fields(self):
        # Prueba que la respuesta contiene los campos correctos
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("user_id", response.data)
        self.assertIn("username", response.data)
        self.assertIn("is_staff", response.data)

    def test_me_admin_user(self):
        # Prueba obtener información de usuario administrador
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "admin")
        self.assertTrue(response.data["is_staff"])

    def test_me_without_authentication(self):
        # Prueba acceso a /me/ sin autenticación
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_invalid_token(self):
        # Prueba acceso con token inválido
        self.client.credentials(HTTP_AUTHORIZATION="Token invalidtoken")
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_multiple_users_see_own_data(self):
        # Prueba que cada usuario solo ve sus propios datos
        user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="pass123"
        )
        token2 = Token.objects.create(user=user2)

        # Usuario 1 obtiene su información
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response1 = self.client.get("/api/auth/me/")

        # Usuario 2 obtiene su información
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token2.key}")
        response2 = self.client.get("/api/auth/me/")

        self.assertEqual(response1.data["username"], "testuser")
        self.assertEqual(response2.data["username"], "user2")
        self.assertNotEqual(response1.data["username"], response2.data["username"])
