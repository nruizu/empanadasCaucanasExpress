# Para correr el proyecto

**Para levantar los contenedores:**
```javascript  
  docker compose up --build
```

**Para ver estado de los contenedores:**
```javascript  
  docker compose ps
```

**Nota:** Hasta el momento debería mostrar dos: *postgresql* y *backend* (django).

**Para verificar que PostgreSQL esté listo**
```javascript  
  docker compose exec postgres pg_isready -U "$DB_USER" -d "$DB_NAME"
```

**Nota:** Debe responder `accepting connections`

**Para ver logs y salud de los contenedores:**
```javascript  
  docker compose logs -f backend
  docker compose logs -f postgres
```

**Detener contenedores:**
```javascript  
  docker compose down
```
