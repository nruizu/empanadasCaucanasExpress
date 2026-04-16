# Implementacion End-to-End Domicilios con Geocodificacion (Fases 1 a 9)

> Documentacion tecnica detallada de implementacion y pruebas:
> `docs/implementacion-y-pruebas-cobertura-domicilios.md`

## Objetivo
Implementar validacion de direccion por coordenadas para pedidos a domicilio, con cobertura configurable por admin, sin afectar pedidos de tipo `pickup` ni `scheduled`.

## Alcance funcional implementado
- Validacion de direccion de entrega usando Nominatim (OpenStreetMap).
- Calculo de distancia desde el local configurado por admin hasta la direccion del cliente.
- Rechazo de pedidos de domicilio fuera de cobertura o con direccion invalida.
- Endpoint de prevalidacion para checkout antes de crear el pedido.
- Boton para abrir Google Maps desde el panel de pedidos admin.
- Campos de trazabilidad en pedido: coordenadas, distancia, estado y mensaje de validacion.
- Llamadas al validador aplicadas solo para `delivery_method = delivery`.

## Fase 1: Configuracion de local y limite de cobertura
### Implementado
- Se creo el modelo `DeliveryCoverageSettings` para configurar:
  - Latitud del local
  - Longitud del local
  - Limite maximo de cobertura (km)
  - Estado activo/inactivo
  - Nota de cobertura
- Se registro el modelo en Django Admin.

### Archivos
- `backend/catalog/models.py`
- `backend/catalog/admin.py`
- `backend/catalog/migrations/0006_delivery_coverage_and_order_geo_fields.py`

## Fase 2: Campos geograficos en pedidos
### Implementado
Se agregaron campos a `Order`:
- `delivery_latitude`
- `delivery_longitude`
- `delivery_distance_km`
- `address_validation_status`
- `address_validation_message`
- `delivery_maps_url`

### Archivos
- `backend/catalog/models.py`
- `backend/catalog/migrations/0006_delivery_coverage_and_order_geo_fields.py`
- `backend/catalog/serializers.py`

## Fase 3: Servicio de geocodificacion
### Implementado
- Servicio dedicado en `backend/catalog/services/delivery_geo.py` con:
  - Normalizacion de direccion
  - Geocodificacion con Nominatim
  - Cache local de resultados
  - Construccion de URL de navegacion en Google Maps

### Configuracion
Se agregaron settings para parametrizar sin hardcode:
- `DELIVERY_DEFAULT_CITY`
- `DELIVERY_DEFAULT_REGION`
- `DELIVERY_DEFAULT_COUNTRY`
- `NOMINATIM_GEOCODE_URL`
- `NOMINATIM_TIMEOUT_SECONDS`
- `NOMINATIM_USER_AGENT`

### Archivos
- `backend/catalog/services/delivery_geo.py`
- `backend/catalog/services/__init__.py`
- `backend/config/settings.py`

## Fase 4: Validacion de formato, existencia y cobertura (solo delivery)
### Implementado
- En `OrderSerializer.validate` se integra validacion geografica.
- Si el metodo es `delivery`, se valida direccion y cobertura.
- Si el metodo es `pickup` o `scheduled`, no se llama geocodificacion.
- Se limpian campos geograficos para tipos no delivery.

### Regla de negocio principal
- Si resultado de validacion es `invalid`, `out_of_coverage` o `service_error`, el pedido se rechaza con error en `delivery_address`.

### Archivos
- `backend/catalog/serializers.py`

## Fase 5: Endpoint de prevalidacion de direccion
### Implementado
- Nuevo endpoint: `POST /api/orders/delivery/validate/`
- Permite validar direccion antes de confirmar pedido.
- Respuesta incluye:
  - `status`
  - `message`
  - `latitude`
  - `longitude`
  - `distance_km`
  - `delivery_maps_url`

### Archivos
- `backend/catalog/views.py`
- `backend/catalog/urls.py`
- `backend/catalog/serializers.py`

## Fase 6: Checkout frontend con bloqueo por validacion
### Implementado
- Boton `Validar direccion` en checkout cuando el usuario elige domicilio.
- Mensajes de validacion en UI.
- Bloqueo de confirmacion si el pedido es delivery y no esta validado como `valid`.
- Si usuario cambia metodo o direccion, se invalida estado previo para obligar revalidacion.

### Archivos
- `frontend/components/checkout/CheckoutForm.tsx`
- `frontend/lib/delivery-api.ts`

## Fase 7: Flujo repartidor/admin hacia Google Maps
### Implementado
- En admin pedidos, si el pedido es delivery y tiene URL, se muestra boton:
  - `Abrir en Google Maps`
- Se muestran tambien estado de validacion, direccion y distancia.

### Archivos
- `frontend/app/admin/pedidos/page.tsx`
- `frontend/lib/auth-api.ts`

## Fase 8: Manejo de errores y mensajes
### Implementado
- Errores controlados para:
  - Direccion corta/invalida
  - Direccion fuera de cobertura
  - Falla temporal del servicio externo
  - Falta de configuracion de cobertura activa
- Mensajes retornados al frontend en texto entendible para usuario.

### Archivos
- `backend/catalog/services/delivery_geo.py`
- `backend/catalog/serializers.py`
- `frontend/components/checkout/CheckoutForm.tsx`

## Fase 9: Pruebas
### Implementado
Se agregaron pruebas de backend para:
- Prevalidacion exitosa
- Creacion de pedido delivery con persistencia de coordenadas
- Rechazo fuera de cobertura
- Confirmacion de que pickup no ejecuta validador geografico

### Archivos
- `backend/catalog/tests/test_delivery_validation.py`

### Comando ejecutado
```bash
cd backend
DJANGO_ENV=test python manage.py test backend.catalog.tests.test_delivery_validation -v 2
```
Resultado: 4 pruebas, todas exitosas.

## Contratos API implementados
### 1) Prevalidar direccion
`POST /api/orders/delivery/validate/`

Request:
```json
{
  "delivery_address": "Calle 10 #20-30"
}
```

Response 200 (valida):
```json
{
  "status": "valid",
  "message": "Direccion valida y dentro de cobertura",
  "latitude": "2.4450000",
  "longitude": "-76.6140000",
  "distance_km": "2.300",
  "delivery_maps_url": "https://www.google.com/maps/dir/?api=1&destination=2.4450000%2C-76.6140000"
}
```

Response 400 (invalida / fuera / error servicio):
```json
{
  "status": "out_of_coverage",
  "message": "La direccion esta fuera de cobertura (12.100 km > 5.00 km)",
  "latitude": "2.4450000",
  "longitude": "-76.6140000",
  "distance_km": "12.100",
  "delivery_maps_url": "https://www.google.com/maps/dir/?api=1&destination=2.4450000%2C-76.6140000"
}
```

### 2) Crear pedido delivery
`POST /api/orders/`
- Si `delivery_method = delivery`, el backend valida y solo crea pedido si pasa.
- Si `pickup` o `scheduled`, la validacion geografica no se ejecuta.

## Cambios de ingenieria aplicados (KISS)
- Servicio aislado y simple para geocodificacion (`delivery_geo.py`).
- Reuso de serializador principal para aplicar reglas en un unico punto.
- Endpoint de prevalidacion separado para no forzar creacion de pedido.
- Sin dependencias extra: uso de librerias estandar + Django cache local.

## Notas operativas
- Este enfoque es funcional y gratis para bajo volumen.
- Nominatim publico tiene limites; para alta carga se debe migrar a proveedor dedicado o instancia propia.
- Para activar cobertura, crear al menos un registro activo en `DeliveryCoverageSettings` desde Admin.

## Referencia completa de archivos cambiados
- `backend/catalog/models.py`
- `backend/catalog/admin.py`
- `backend/catalog/serializers.py`
- `backend/catalog/views.py`
- `backend/catalog/urls.py`
- `backend/catalog/services/__init__.py`
- `backend/catalog/services/delivery_geo.py`
- `backend/catalog/migrations/0006_delivery_coverage_and_order_geo_fields.py`
- `backend/config/settings.py`
- `backend/catalog/tests/test_delivery_validation.py`
- `frontend/components/checkout/CheckoutForm.tsx`
- `frontend/app/admin/pedidos/page.tsx`
- `frontend/lib/delivery-api.ts`
- `frontend/lib/auth-api.ts`
