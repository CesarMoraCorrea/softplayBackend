# 🏗️ Arquitectura del Backend - SoftPlay

## Estructura General

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                 # Configuración de MongoDB
│   ├── controllers/               # Lógica de negocio
│   │   ├── auth.controller.js
│   │   ├── cancha.controller.js
│   │   ├── captcha.controller.js
│   │   ├── payment.controller.js
│   │   ├── reserva.controller.js
│   │   ├── upload.controller.js
│   │   └── user.controller.js
│   ├── models/                    # Esquemas de Mongoose
│   │   ├── User.js
│   │   ├── Cancha.js
│   │   └── Reserva.js
│   ├── routes/                    # Rutas API
│   │   ├── auth.routes.js
│   │   ├── cancha.routes.js
│   │   ├── payment.routes.js
│   │   ├── reserva.routes.js
│   │   ├── upload.routes.js
│   │   ├── user.routes.js
│   │   └── captcha.routes.js
│   ├── middlewares/               # Middlewares
│   │   └── auth.js               # JWT y autorización
│   ├── utils/
│   │   └── roles.js              # Definición de roles
│   ├── app.js                     # Configuración de Express
│   └── server.js                  # Punto de entrada
├── api/
│   └── index.js                   # Para despliegue en Vercel
├── app.js                         # Re-exporta src/app.js
├── server.js                      # Re-exporta src/server.js
├── package.json
├── .env
└── vercel.json
```

## Componentes Principales

### 1. **Models** (`src/models/`)

#### User.js
- email (único)
- password (hasheada con bcryptjs)
- nombre
- teléfono
- rol (USER, ADMIN_CANCHA, ADMIN_SISTEMA)
- activo (boolean)

#### Cancha.js
- nombre
- descripción
- dirección
- ubicación (lat, lng)
- precioHora
- imagenes (array)
- tipoCancha
- servicios (array)
- horarios
- propietario (referencia a User)

#### Reserva.js
- usuario (referencia a User)
- cancha (referencia a Cancha)
- fecha
- horas
- total
- estado (pendiente, pagada, cancelada)
- paymentIntentId (Stripe)
- paymentMethod
- transactionId

### 2. **Controllers** (`src/controllers/`)

#### auth.controller.js
- `register()` - Crear usuario con CAPTCHA
- `login()` - Autenticación con JWT
- `me()` - Obtener datos del usuario autenticado

#### cancha.controller.js
- `listCanchas()` - Listar con filtros
- `getCancha()` - Obtener detalle
- `createCancha()` - Admin only
- `updateCancha()` - Admin only
- `deleteCancha()` - Admin only

#### reserva.controller.js
- CRUD completo de reservas

#### payment.controller.js
- Integración con Stripe

#### upload.controller.js
- Manejo de carga de imágenes

### 3. **Routes** (`src/routes/`)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/register` | POST | Registro de usuario |
| `/api/auth/login` | POST | Login con JWT |
| `/api/auth/me` | GET | Usuario actual (protegido) |
| `/api/canchas` | GET | Listar canchas |
| `/api/canchas/:id` | GET | Detalle de cancha |
| `/api/canchas` | POST | Crear cancha (admin) |
| `/api/canchas/:id` | PUT | Actualizar cancha (admin) |
| `/api/canchas/:id` | DELETE | Eliminar cancha (admin) |
| `/api/reservas` | GET/POST | CRUD reservas |
| `/api/payments` | POST | Procesar pago Stripe |
| `/api/upload` | POST | Cargar imágenes |

### 4. **Middlewares** (`src/middlewares/`)

#### auth.js
- `protect` - Verifica JWT
- `isAdminCancha` - Verifica rol admin cancha
- `isAdminSistema` - Verifica rol admin sistema
- `authorize` - Control granular de acceso

### 5. **Autenticación**

**JWT (JSON Web Tokens)**
- Expiración: 7 días
- Variable de entorno: `JWT_SECRET`
- Header: `Authorization: Bearer <token>`
- Axios interceptor inyecta automáticamente

**Password Hashing**
- Algoritmo: bcryptjs
- Salt rounds: 10

**CAPTCHA**
- SVG-captcha en login/register
- Validación en servidor

## Flujo de Integración

### Autenticación
```
Cliente -> POST /api/auth/login 
-> Validar email/password 
-> Generar JWT 
-> Retornar token 
-> Cliente almacena en localStorage
```

### Protección de Rutas
```
Cliente -> API call con Authorization header
-> Middleware auth verifica JWT
-> Middleware verifica rol si es necesario
-> Ejecuta controller
-> Retorna respuesta
```

### Creación de Cancha
```
Admin -> POST /api/canchas con datos
-> Middleware auth verifica JWT
-> Middleware verifica rol ADMIN_CANCHA
-> Controller crea en MongoDB
-> Retorna cancha creada
```

## Variables de Entorno (.env)

```
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/softplay
JWT_SECRET=tu_secreto_super_seguro_aqui
STRIPE_SECRET=sk_test_...
PORT=5000
NODE_ENV=development
```

## Configuración Base de Datos

```javascript
// src/config/db.js
import mongoose from 'mongoose';

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');
    console.log('✅ MongoDB conectado');
  } catch (error) {
    console.error('❌ Error BD:', error.message);
    process.exit(1);
  }
}
```

## Ejecución

### Desarrollo
```bash
npm install
npm run dev  # Inicia con nodemon
```

### Producción
```bash
npm start
```

## API Health Check

```bash
GET http://localhost:5000/api/health
```

## Roles y Permisos

| Rol | Permisos |
|-----|----------|
| USER | Crear/editar/ver propias reservas |
| ADMIN_CANCHA | Crear/editar/eliminar sus canchas |
| ADMIN_SISTEMA | Acceso total a todo |

## Cambios en esta Versión

- ✨ Refactorización a estructura `src/` profesional
- 📁 Organización clara por funcionalidad
- 🚀 Mejora en mantenibilidad y escalabilidad
- 📚 Compatibilidad hacia atrás con `app.js` y `server.js` en raíz
