# Portal de encuentros

El visitante ingresa solo su celular. No se pide contrasena ni una cuenta administrativa.

- Registrado: ve su grupo y confirma asistencia sin volver a escribir el numero.
- Nuevo: elige un grupo activo, completa sus datos y confirma asistencia cuando haya un evento.
- Cambiar celular: vuelve a la consulta inicial.

La API `/api/public` consulta miembros y mantiene el alcance de grupo. El token publico
no permite acceder al panel ni editar miembros, eventos, grupos u ofrendas.
No acredita la titularidad del celular. Los administradores conservan su acceso con
correo y contrasena en `frontend-admin`.

Desplegar este frontend junto con el backend actualizado. No se requiere migracion de datos.
Validacion: `npm run build`; pruebas de API: `python -m pytest -q` desde `backend`.

## Backend local y Cloud Run

- `npm run dev`: usa `/api`, que Vite redirige a `http://127.0.0.1:8000`.
- `npm run build`: usa Cloud Run mediante `.env.production`.
- Para probar Cloud Run desde el frontend local, crear `.env.development.local` con:

```env
VITE_API_URL=https://casa-del-rey-api-708265049038.us-central1.run.app/api
```

Para volver al backend local, cambiar ese valor a `/api`. Reiniciar Vite tras cambiar
variables de entorno. `VITE_API_URL` tiene prioridad sobre la seleccion por entorno.
Se utiliza un backend por ejecucion; no se duplican las solicitudes entre servidores.
Cloud Run requiere desplegar la version del backend que incluye `/api/public/identificar`.
