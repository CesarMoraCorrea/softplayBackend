# Backend - Canchas (MERN)
## Scripts
- `npm run dev` arranca con nodemon
## Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/canchas` `GET /api/canchas/:id` `POST /api/canchas` `PUT /api/canchas/:id` `DELETE /api/canchas/:id`
- `POST /api/reservas` `GET /api/reservas/mias` `GET /api/reservas/cancha/:canchaId`
- `POST /api/upload` (form-data files[])
- `POST /api/payments/intent` (reservaId)

## Despliegue en Vercel + MongoDB Atlas

### Backend (este directorio como proyecto en Vercel)
- Root Directory: `softplay_backend`
- Las funciones serverless viven en `api/index.js` y exponen la app de Express bajo `/api/*`.
- Variables de entorno requeridas en Vercel:
  - `MONGO_URI` (cadena de conexión de Atlas)
  - `JWT_SECRET`
  - `STRIPE_SECRET`

### MongoDB Atlas
1. Crea un cluster en Atlas y un usuario con permisos de lectura/escritura.
2. Obtén la cadena de conexión (Driver: `Node.js`, versión `4.x`/`5.x`).
3. Configura `MONGO_URI` en Vercel, por ejemplo:
   `mongodb+srv://<USER>:<PASS>@<CLUSTER>/<DBNAME>?retryWrites=true&w=majority&appName=<APP>`

### Frontend (proyecto separado en Vercel)
- Root Directory: `softplay_frontend`
- Build Command: `npm run build` | Output Directory: `dist`
- Configura `VITE_API_URL` apuntando al backend desplegado, por ejemplo:
  `https://<tu-backend>.vercel.app/api`

### Nota sobre `/uploads`
- Vercel tiene sistema de archivos efímero. Para persistir imágenes, usa un almacenamiento externo (p.ej. Cloudinary, S3, Supabase Storage) en lugar de guardar en `uploads/`.

## Subida de imágenes con MongoDB GridFS

### ¿Qué es GridFS?
- Almacena archivos binarios dentro de MongoDB en dos colecciones: `<bucket>.files` y `<bucket>.chunks`.
- En este proyecto usamos `bucketName: "uploads"` para mantener las imágenes.

### Endpoints
- `POST /api/upload` (form-data `files[]`): sube imágenes a GridFS y retorna `{ files: [ObjectIdString], urls: ["/api/upload/files/:id"] }`.
- `GET /api/upload/files/:id`: sirve el binario de la imagen vía streaming con `Content-Type` y cabeceras de caché.

### Frontend
- Guarda en tus documentos (p.ej. `Cancha.imagenes`) los IDs retornados.
- El helper `imageUrl()` reconoce:
  - IDs de GridFS (24 hex) y construye `VITE_API_URL + /upload/files/:id`.
  - URLs absolutas (Cloudinary/S3) como están.
  - Nombres o rutas locales `/uploads` para modo desarrollo.

### Requisitos
- Conexión a Mongo Atlas mediante `MONGO_URI` ya configurada.
- No se usa disco local en producción; toda persistencia de imágenes queda en Atlas.

### Buenas prácticas
- Limita tamaño de archivos y tipos (ya configurado a 5MB y `image/*`).
- Mantén `POST /api/upload` protegido (requiere rol admin de cancha).
