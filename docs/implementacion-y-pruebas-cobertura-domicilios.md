# Implementacion y estrategia de pruebas: cobertura de domicilios

## 1. Resumen ejecutivo
Este documento describe en detalle la implementacion de la validacion geografica para pedidos a domicilio y la estrategia de pruebas aplicada.

Objetivos cumplidos:
- Validar direcciones de domicilio con servicio externo gratuito (Nominatim / OpenStreetMap).
- Calcular distancia entre direccion del cliente y local de venta.
- Bloquear pedidos fuera de cobertura.
- Mantener intacto el flujo de pedidos no-domicilio (`pickup`, `scheduled`).
- Permitir configuracion de cobertura desde una UI admin de frontend (no solo Django admin).

## 2. Requisitos funcionales cubiertos
### 2.1 Requisito R1 - Configuracion admin de cobertura
- El administrador define:
  - Coordenadas del local.
  - Radio maximo de entrega (km).
  - Estado activo/inactivo.
- Implementado en backend y en interfaz frontend admin.

### 2.2 Requisito R2 - Validacion de direccion por servicio externo
- Para `delivery_method=delivery`, el backend consulta Nominatim.
- Se procesan variantes de direccion para mejorar tasa de acierto.

### 2.3 Requisito R3 - Validacion de cobertura
- Se calcula distancia usando Haversine.
- Si `distance_km > max_delivery_km`, se rechaza pedido.

### 2.4 Requisito R4 - Manejo de errores
- Direccion invalida/no encontrada.
- Error de servicio externo (timeout, 429, conectividad).
- Ausencia de configuracion de cobertura activa.

### 2.5 Requisito R5 - No afectar otros tipos de pedido
- `pickup` y `scheduled` no ejecutan geocodificacion.
- Se limpian campos geograficos cuando no aplica delivery.

## 3. Arquitectura tecnica implementada
## 3.1 Backend
### Dominio y persistencia
- Modelo `Order` enriquecido con:
  - `delivery_latitude`
  - `delivery_longitude`
  - `delivery_distance_km`
  - `address_validation_status`
  - `address_validation_message`
  - `delivery_maps_url`
- Modelo nuevo `DeliveryCoverageSettings` para configuracion de cobertura.

### Capa de servicio
- Servicio: `backend/catalog/services/delivery_geo.py`
- Responsabilidades:
  - Normalizacion de direccion.
  - Construccion de queries alternativas.
  - Geocodificacion en Nominatim.
  - Cache de geocodificacion.
  - Calculo de distancia (Haversine).
  - Construccion de URL Google Maps.

### Capa API
- Endpoint prevalidacion checkout:
  - `POST /api/orders/delivery/validate/`
- Endpoint admin para configuracion de cobertura:
  - `GET /api/admin/delivery-coverage/`
  - `PUT /api/admin/delivery-coverage/`

## 3.2 Frontend
### Checkout
- Boton de validacion de direccion en formulario de domicilio.
- Bloqueo de confirmacion si no hay validacion exitosa.
- Mensajes explicitos de error/estado.

### Admin
- Vista nueva:
  - `/admin/cobertura`
- Formulario para editar latitud, longitud, radio, estado y notas.
- Acceso agregado en menu lateral de administracion.

## 4. Trazabilidad de implementacion por archivo
### 4.1 Backend
- `backend/catalog/models.py`
- `backend/catalog/migrations/0006_delivery_coverage_and_order_geo_fields.py`
- `backend/catalog/serializers.py`
- `backend/catalog/views.py`
- `backend/catalog/urls.py`
- `backend/catalog/services/delivery_geo.py`
- `backend/config/settings.py`
- `backend/catalog/admin.py`

### 4.2 Frontend
- `frontend/components/checkout/CheckoutForm.tsx`
- `frontend/lib/delivery-api.ts`
- `frontend/lib/auth-api.ts`
- `frontend/app/admin/pedidos/page.tsx`
- `frontend/lib/admin-delivery-coverage-api.ts`
- `frontend/app/admin/cobertura/page.tsx`
- `frontend/components/Navbar.tsx`

### 4.3 Pruebas
- `backend/catalog/tests/test_delivery_validation.py`
- `backend/catalog/tests/test_admin_delivery_coverage.py`

## 5. Estrategia de pruebas
La estrategia aplicada sigue una estructura por capas para minimizar riesgo funcional con costo razonable:

- Pruebas unitarias de logica pura: validan reglas atomicas y comportamiento determinista.
- Pruebas de integracion API: validan contrato REST, permisos, serializacion, persistencia y reglas de negocio.
- Pruebas E2E/manuales: validan recorrido real usuario-admin en UI (frontend + backend + servicio externo).

Justificacion:
- La validacion de domicilios combina reglas de negocio, IO externo y experiencia de usuario.
- Ningun tipo de prueba por si sola cubre todo el riesgo.
- Integracion + manual E2E entrega mayor confianza para flujos con dependencia externa (Nominatim).

## 6. Clasificacion de pruebas ejecutadas
## 6.1 Pruebas de integracion (ejecutadas)
### Archivo: `backend/catalog/tests/test_delivery_validation.py`
Tipo: Integracion API

Casos:
- `test_prevalidation_endpoint_valid_response`
  - Valida contrato de `POST /api/orders/delivery/validate/`.
  - Usa mock del servicio de validacion para verificar respuesta API.
- `test_create_delivery_order_persists_geo_fields`
  - Valida integracion serializer + vista + modelo al crear pedido delivery.
  - Verifica persistencia de coordenadas/distancia/estado.
- `test_create_delivery_order_rejects_out_of_coverage`
  - Verifica rechazo API con estado HTTP 400 para fuera de cobertura.
- `test_pickup_order_does_not_trigger_delivery_validation`
  - Verifica regla de aislamiento: pickup no debe geocodificar.

Por que es integracion y no unitario:
- Se prueba endpoint/serializer/modelo como sistema combinado.
- Se valida comportamiento HTTP y persistencia real en DB de pruebas.

### Archivo: `backend/catalog/tests/test_admin_delivery_coverage.py`
Tipo: Integracion API

Casos:
- `test_requires_admin_permissions`
  - Verifica autorizacion del endpoint admin (staff obligatorio).
- `test_admin_can_create_and_update_coverage`
  - Verifica ciclo completo crear/actualizar configuracion.
- `test_admin_get_returns_last_saved_settings`
  - Verifica lectura de configuracion vigente.

Por que es integracion y no unitario:
- Involucra autenticacion DRF, permisos, serializers, vistas y ORM.

## 6.2 Pruebas unitarias (estado actual)
Ejecutadas explicitamente: no se agrego un modulo unitario puro separado en esta iteracion.

Razon:
- Se priorizo cobertura funcional end-to-end del backend via pruebas de integracion.
- Parte critica (geocodificacion) depende de IO externo; se aisló con mocks en pruebas de integracion.

Recomendacion de mejora:
- Agregar `test_delivery_geo_unit.py` para funciones puras:
  - `haversine_km`
  - `build_google_maps_url`
  - `build_address_queries`

## 6.3 Pruebas E2E (estado actual)
Automatizadas: no implementadas en esta iteracion.

E2E manual realizadas durante desarrollo:
- Configurar cobertura en UI admin `/admin/cobertura`.
- Intentar validar direccion en checkout.
- Confirmar bloqueo de pedido fuera de zona.
- Confirmar que pickup/scheduled no se bloquean por geocodificacion.

Por que clasifica como E2E manual:
- Recorre frontend + backend + servicio externo real.
- Emula experiencia completa de usuario final y administrador.

## 7. Evidencia de ejecucion de pruebas automatizadas
Comando ejecutado:

```bash
DJANGO_ENV=test python manage.py test backend.catalog.tests.test_admin_delivery_coverage backend.catalog.tests.test_delivery_validation -v 2
```

Resultado:
- 7 pruebas ejecutadas.
- 7 pruebas exitosas.
- Sin errores de sistema.

## 8. Matriz requisito -> prueba
- R1 (config admin cobertura):
  - `test_admin_can_create_and_update_coverage`
  - `test_admin_get_returns_last_saved_settings`
  - `test_requires_admin_permissions`
- R2 (validacion direccion externa):
  - `test_prevalidation_endpoint_valid_response`
- R3 (bloqueo fuera cobertura):
  - `test_create_delivery_order_rejects_out_of_coverage`
- R4 (persistencia trazabilidad):
  - `test_create_delivery_order_persists_geo_fields`
- R5 (no impactar pickup/scheduled):
  - `test_pickup_order_does_not_trigger_delivery_validation`

## 9. Riesgos residuales y mitigaciones
### 9.1 Dependencia de Nominatim publico
Riesgo:
- Limites de uso y resultados variables por direccion.

Mitigacion aplicada:
- Queries alternativas.
- Cache local.
- Mensajes claros para reintento y formato sugerido.

Mitigacion recomendada futura:
- Proveedor dedicado o instancia propia de Nominatim.

### 9.2 No hay E2E automatizado
Riesgo:
- Cambios futuros en frontend/backend podrian romper flujo sin deteccion temprana.

Mitigacion recomendada:
- Agregar Playwright/Cypress para:
  - login admin
  - guardar cobertura
  - checkout delivery valid/invalid
  - assert bloqueo/aceptacion

## 10. Criterio de calidad alcanzado
Se logra un estado funcional y mantenible con enfoque KISS:
- Logica geografica centralizada en un servicio.
- Reglas de negocio en serializer del pedido.
- Endpoint dedicado para prevalidacion.
- UI admin dedicada e intuitiva para configuracion de cobertura.
- Cobertura automatizada de integracion para los flujos criticos.

## 11. Checklist operativo para QA
- [ ] Existe registro de cobertura activo en `/admin/cobertura`.
- [ ] Pedido `delivery` dentro de zona valida y crea orden.
- [ ] Pedido `delivery` fuera de zona es rechazado.
- [ ] Pedido `pickup` se crea sin validar geocodificacion.
- [ ] Pedido `scheduled` se crea sin validar geocodificacion.
- [ ] En admin pedidos se visualiza estado de validacion y boton Google Maps para delivery.

## 12. Referencias
- Documento funcional por fases:
  - `docs/delivery-domicilio-fases-1-a-9.md`
