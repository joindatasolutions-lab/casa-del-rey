# Casa del Rey Backend

Backend sincrono para el piloto de Casa del Rey usando FastAPI, SQLAlchemy 2.x, psycopg y PostgreSQL.

## Desarrollo local

Requisitos:

- Python 3.12+
- Acceso a PostgreSQL
- Base de datos `joinflower-dev`
- Usuario `joindata`
- Schema exclusivo `casa_del_rey`

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Si ejecutas Uvicorn desde la raiz del proyecto:

```powershell
uvicorn --app-dir backend app.main:app --reload
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

## Variables de entorno

Configura `backend/.env`:

```env
DB_HOST=
DB_PORT=5432
DB_NAME=joinflower-dev
DB_USER=joindata
DB_PASSWORD=
DB_SCHEMA=casa_del_rey
JWT_SECRET=
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
CORS_ORIGINS=http://localhost:5173
```

`CORS_ORIGINS` soporta multiples origenes separados por coma.

## Usuario admin inicial

Configura `JWT_SECRET` antes de usar autenticacion. Luego crea un usuario:

```powershell
python scripts\create_admin_user.py `
  --email admin@casadelrey.local `
  --name "Administrador" `
  --role SUPER_ADMIN
```

Para crear un lider de grupo:

```powershell
python scripts\create_admin_user.py `
  --email lider@casadelrey.local `
  --name "Lider Grupo" `
  --role LIDER_GRUPO `
  --id-grupo 1
```

El script pide password de forma interactiva y no lo imprime.

## Aislamiento de base de datos

- No se usa `Base.metadata.create_all()`.
- No se crean ni alteran tablas desde la aplicacion.
- No se usa ni modifica el schema `petalops`.
- No se depende de `search_path`.
- Los modelos usan `schema="casa_del_rey"`.
- Las ForeignKey usan nombres completos como `casa_del_rey.grupos.id_grupo`.

## Endpoints

Base URL local:

```text
http://127.0.0.1:8000
```

Health:

- `GET /api/health`

Auth:

- `POST /api/auth/login`
- `GET /api/auth/me`

Grupos:

- `GET /api/grupos`
- `POST /api/grupos`
- `GET /api/grupos/{id_grupo_o_slug}`
- `PATCH /api/grupos/{id_grupo}`
- `PATCH /api/grupos/{id_grupo}/estado`

Miembros:

- `GET /api/miembros`
- `GET /api/miembros/buscar?celular=3001234567&grupo_id=1`
- `POST /api/miembros`
- `GET /api/miembros/{id_miembro}`
- `PATCH /api/miembros/{id_miembro}`
- `PATCH /api/miembros/{id_miembro}/estado`
- `PATCH /api/miembros/{id_miembro}/rio-de-dios`

Eventos:

- `POST /api/eventos`
- `POST /api/eventos/generar`
- `GET /api/grupos/{id_grupo}/eventos`
- `GET /api/grupos/{id_grupo}/eventos/proximo`
- `GET /api/eventos/{id_evento}`
- `PATCH /api/eventos/{id_evento}`
- `PATCH /api/eventos/{id_evento}/estado`
- `PATCH /api/eventos/{id_evento}/ofrenda`
- `GET /api/eventos/{id_evento}/asistencia`

Asistencias:

- `POST /api/asistencias/confirmar`
- `PATCH /api/asistencias/marcar`

## Guia rapida para probar

Puedes probar todo desde Swagger:

```text
http://127.0.0.1:8000/docs
```

Tambien puedes usar Thunder Client, Postman o `curl`.

### Health

```powershell
curl http://127.0.0.1:8000/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "database": "connected",
  "schema": "casa_del_rey"
}
```

### Grupos

Listar grupos:

```powershell
curl http://127.0.0.1:8000/api/grupos
```

Buscar grupo por ID:

```powershell
curl http://127.0.0.1:8000/api/grupos/1
```

Buscar grupo por slug:

```powershell
curl http://127.0.0.1:8000/api/grupos/red-solteros-1
```

### Miembros

Buscar miembro por celular y grupo:

```powershell
curl "http://127.0.0.1:8000/api/miembros/buscar?celular=3128896624&grupo_id=1"
```

Crear miembro:

```powershell
curl -X POST http://127.0.0.1:8000/api/miembros `
  -H "Content-Type: application/json" `
  -d '{
    "id_grupo": 1,
    "nombre": "Juan",
    "apellido": "Perez",
    "fecha_nacimiento": "1990-01-01",
    "genero": "H",
    "celular": "3001234567",
    "direccion": "Direccion opcional",
    "contacto_emergencia": "Contacto opcional",
    "telefono_emergencia": "3007654321"
  }'
```

Actualizar Rio de Dios:

```powershell
curl -X PATCH http://127.0.0.1:8000/api/miembros/1/rio-de-dios `
  -H "Content-Type: application/json" `
  -d '{
    "rio_de_dios": "PEC"
  }'
```

Valores permitidos para `rio_de_dios`:

```text
NUEVO, CHANGE, PEC, ADL, GRADUADO, LANZADO, LIDER
```

Editar miembro:

```powershell
curl -X PATCH http://127.0.0.1:8000/api/miembros/1 `
  -H "Content-Type: application/json" `
  -d '{
    "nombre": "Juan",
    "apellido": "Perez",
    "fecha_nacimiento": "1990-01-01",
    "genero": "H",
    "celular": "3001234567",
    "direccion": "Direccion actualizada",
    "contacto_emergencia": "Contacto",
    "telefono_emergencia": "3007654321"
  }'
```

Cambiar estado de miembro:

```powershell
curl -X PATCH http://127.0.0.1:8000/api/miembros/1/estado `
  -H "Content-Type: application/json" `
  -d '{
    "estado": "INACTIVO"
  }'
```

Valores permitidos para `estado`:

```text
ACTIVO, INACTIVO
```

### Eventos

Crear evento manual:

```powershell
curl -X POST http://127.0.0.1:8000/api/eventos `
  -H "Content-Type: application/json" `
  -d '{
    "id_grupo": 1,
    "nombre_evento": "Grupo de Oracion Red Solteros",
    "fecha_evento": "2026-09-09",
    "hora_evento": "19:00:00",
    "ubicacion": "Cra. 58, 98-71 - Edificio Toledo",
    "descripcion": "Encuentro semanal de grupo de oracion",
    "ofrenda_global": 0,
    "estado": "ACTIVO"
  }'
```

Listar eventos de un grupo:

```powershell
curl http://127.0.0.1:8000/api/grupos/1/eventos
```

Obtener proximo evento activo:

```powershell
curl http://127.0.0.1:8000/api/grupos/1/eventos/proximo
```

Obtener evento por ID:

```powershell
curl http://127.0.0.1:8000/api/eventos/5
```

Actualizar ofrenda global:

```powershell
curl -X PATCH http://127.0.0.1:8000/api/eventos/5/ofrenda `
  -H "Content-Type: application/json" `
  -d '{
    "ofrenda_global": 250000
  }'
```

### Asistencias

Confirmar asistencia:

```powershell
curl -X POST http://127.0.0.1:8000/api/asistencias/confirmar `
  -H "Content-Type: application/json" `
  -d '{
    "id_miembro": 1,
    "id_evento": 5,
    "confirmacion": "ASISTIRA"
  }'
```

Valores permitidos para `confirmacion`:

```text
ASISTIRA, NO_ASISTIRA
```

Marcar asistencia real:

```powershell
curl -X PATCH http://127.0.0.1:8000/api/asistencias/marcar `
  -H "Content-Type: application/json" `
  -d '{
    "id_miembro": 1,
    "id_evento": 5,
    "asistio": "SI"
  }'
```

Valores permitidos para `asistio`:

```text
SI, NO
```

Ver detalle de asistencia y metricas de un evento:

```powershell
curl http://127.0.0.1:8000/api/eventos/5/asistencia
```

## Endpoints publicos

- `GET /api/health`
- `GET /api/grupos/{id_grupo_o_slug}`
- `GET /api/grupos/{id_grupo}/eventos/proximo`
- `GET /api/miembros/buscar?celular=3001234567&grupo_id=1`
- `POST /api/miembros`
- `POST /api/asistencias/confirmar`

## Endpoints protegidos

Usan header:

```text
Authorization: Bearer TU_TOKEN
```

- `GET /api/auth/me`
- `GET /api/grupos`
- `POST /api/grupos`
- `PATCH /api/grupos/{id_grupo}`
- `PATCH /api/grupos/{id_grupo}/estado`
- `GET /api/miembros`
- `GET /api/miembros/{id_miembro}`
- `PATCH /api/miembros/{id_miembro}`
- `PATCH /api/miembros/{id_miembro}/estado`
- `PATCH /api/miembros/{id_miembro}/rio-de-dios`
- `POST /api/eventos`
- `POST /api/eventos/generar`
- `GET /api/grupos/{id_grupo}/eventos`
- `GET /api/eventos/{id_evento}`
- `PATCH /api/eventos/{id_evento}`
- `PATCH /api/eventos/{id_evento}/estado`
- `PATCH /api/eventos/{id_evento}/ofrenda`
- `GET /api/eventos/{id_evento}/asistencia`
- `PATCH /api/asistencias/marcar`

## Roles

`SUPER_ADMIN` puede operar sobre todos los grupos.

`LIDER_GRUPO` solo puede operar sobre su `id_grupo`. Si intenta operar otro grupo, la API responde `403`.

## Tests

Pruebas seguras, sin escritura en PostgreSQL:

```powershell
python -m pytest -q
```

Pruebas de integracion con escritura temporal en PostgreSQL:

```powershell
$env:RUN_DB_INTEGRATION_TESTS="1"
python -m pytest -q
```

Estas pruebas crean datos temporales y los limpian al terminar.

## Docker

Construir imagen:

```powershell
docker build -t casa-del-rey-backend .
```

Ejecutar:

```powershell
docker run --env-file .env -p 8080:8080 casa-del-rey-backend
```

La app escucha el puerto `${PORT:-8080}`.

## Cloud Run

Variables necesarias:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SCHEMA`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `JWT_EXPIRE_MINUTES`
- `CORS_ORIGINS`

Para Cloud SQL, configura la conexion segun el proyecto de GCP y define `DB_HOST` de acuerdo con el modo elegido, por ejemplo IP privada o socket Unix si se adapta la configuracion. No despliegues con `CORS_ORIGINS=*` en produccion.

## Flujo recomendado del piloto

1. Validar backend:

```powershell
curl http://127.0.0.1:8000/api/health
```

2. Obtener grupo:

```powershell
curl http://127.0.0.1:8000/api/grupos/red-solteros-1
```

3. Obtener proximo evento:

```powershell
curl http://127.0.0.1:8000/api/grupos/1/eventos/proximo
```

4. Buscar miembro por celular:

```powershell
curl "http://127.0.0.1:8000/api/miembros/buscar?celular=3128896624&grupo_id=1"
```

5. Confirmar asistencia:

```powershell
curl -X POST http://127.0.0.1:8000/api/asistencias/confirmar `
  -H "Content-Type: application/json" `
  -d '{
    "id_miembro": 1,
    "id_evento": 5,
    "confirmacion": "ASISTIRA"
  }'
```

6. Revisar panel admin de asistencia:

```powershell
curl http://127.0.0.1:8000/api/eventos/5/asistencia
```
