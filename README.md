# 🥟 Empanadas Caucanas Express (e-commerce)

## 📌 Descripción
Portal web desarrollado para la gestión y comercialización en línea de los productos de Empanadas Caucanas Express.
La plataforma permite la visualización del catálogo, la creación de pedidos a domicilio o para recogida en tienda, y la administración básica de la información relacionada con los productos y pedidos.

## 🚀 Instalación y Configuración
### Requisitos
- Docker
- Docker Compose

### Pasos
**1) Levantar contenedores:**
```javascript  
  docker compose up --build
```

**2) Ver estado de los contenedores:**
```javascript  
  docker compose ps
```

**3) Verificar que PostgreSQL esté listo**
```javascript  
  docker compose exec postgres pg_isready -U "$DB_USER" -d "$DB_NAME"
```
**Nota:** Debe responder `accepting connections`

**4) Ver logs y salud de los contenedores:**
```javascript  
  docker compose logs -f backend
  docker compose logs -f postgres
```

**5) Detener contenedores:**
```javascript  
  docker compose down
```