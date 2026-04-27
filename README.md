# Handtype — Guía de despliegue completa

Convierte tu escritura a mano en fuentes tipográficas digitales (OTF/TTF).

**Stack:** React + Vite (Vercel) · Node.js + Express (Railway) · PostgreSQL (Railway)

---

## Estructura del repositorio

```
handtype/
├── frontend/          ← React + Vite → se despliega en Vercel
│   ├── src/
│   │   ├── lib/api.js
│   │   └── pages/
│   │       ├── App.jsx + App.module.css
│   │       └── Gallery.jsx + Gallery.module.css
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json
│   └── package.json
└── backend/           ← Node.js + Express → se despliega en Railway
    ├── src/
    │   ├── index.js
    │   ├── routes/
    │   │   ├── fonts.js
    │   │   └── upload.js
    │   └── services/
    │       ├── db.js
    │       ├── fontBuilder.js
    │       └── imageProcessor.js
    ├── railway.toml
    ├── .env.example
    └── package.json
```

---

## PARTE 1 — Desplegar el backend en Railway

### Paso 1 — Crear cuenta y proyecto
1. Ve a [railway.app](https://railway.app) y crea una cuenta (gratis).
2. Haz clic en **New Project**.

### Paso 2 — Agregar PostgreSQL
1. En tu proyecto, haz clic en **Add Service → Database → PostgreSQL**.
2. Railway crea la base de datos y te entrega una variable `DATABASE_URL` automáticamente.

### Paso 3 — Agregar el servicio backend
1. Haz clic en **Add Service → GitHub Repo** (o Deploy from source).
2. Conecta tu repositorio de GitHub.
3. En la configuración del servicio:
   - **Root Directory:** `backend`
   - Railway detecta automáticamente Node.js y ejecuta `npm start`

### Paso 4 — Variables de entorno en Railway
En el panel del servicio backend, ve a **Variables** y agrega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Se llena automáticamente desde el plugin PostgreSQL |
| `FRONTEND_URL` | `https://tu-proyecto.vercel.app` (lo sabrás en la Parte 2) |
| `NODE_ENV` | `production` |

> Puedes poner `FRONTEND_URL=*` temporalmente mientras configuras Vercel,
> y luego actualizarlo con la URL real.

### Paso 5 — Obtener la URL del backend
Una vez desplegado, Railway te da una URL pública como:
```
https://handtype-backend-production.up.railway.app
```
Guárdala — la necesitarás para configurar Vercel.

---

## PARTE 2 — Desplegar el frontend en Vercel

### Paso 1 — Crear cuenta
1. Ve a [vercel.com](https://vercel.com) y crea una cuenta (gratis).

### Paso 2 — Importar repositorio
1. Haz clic en **Add New Project → Import Git Repository**.
2. Selecciona tu repositorio.
3. En la configuración:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Paso 3 — Variables de entorno en Vercel
En **Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://handtype-backend-production.up.railway.app` |

### Paso 4 — Desplegar
Haz clic en **Deploy**. Vercel te da una URL como:
```
https://handtype.vercel.app
```

### Paso 5 — Actualizar CORS en Railway
Vuelve a Railway y actualiza la variable:
```
FRONTEND_URL=https://handtype.vercel.app
```
Railway redespliega el backend automáticamente.

---

## PARTE 3 — Desarrollo local

### Requisitos
- Node.js 18+
- PostgreSQL local (o usa la URL de Railway en desarrollo)

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tu DATABASE_URL local o de Railway
npm run dev
# Servidor en http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local ya tiene VITE_API_URL=http://localhost:3001
npm run dev
# App en http://localhost:3000
```

---

## API Reference

### `POST /api/fonts/generate`
Genera una fuente a partir de glifos en base64.
```json
// Request body
{
  "fontName": "MiLetra",
  "format": "otf",
  "glyphs": {
    "A": "data:image/png;base64,iVBOR...",
    "B": "data:image/png;base64,iVBOR..."
  }
}

// Response
{
  "id": "uuid",
  "name": "MiLetra",
  "format": "otf",
  "glyphCount": 45,
  "createdAt": "2025-04-20T...",
  "downloadUrl": "/api/fonts/uuid/download"
}
```

### `GET /api/fonts`
Lista las últimas 20 fuentes generadas.

### `GET /api/fonts/:id/download`
Descarga el archivo `.otf` o `.ttf`.

### `DELETE /api/fonts/:id`
Elimina una fuente de la base de datos.

### `POST /api/upload/template`
Sube una imagen de la plantilla escaneada.
- Body: `multipart/form-data` con campo `image`
- Devuelve: `{ glyphCount, glyphs: { "A": "data:image/png;base64,..." } }`

---

## Costos estimados (plan gratuito)

| Servicio | Plan gratuito incluye |
|---|---|
| **Vercel** | 100 GB bandwidth/mes · Ilimitados proyectos hobby |
| **Railway** | $5 USD de crédito/mes · suficiente para uso moderado |
| **PostgreSQL en Railway** | Incluido en el crédito de Railway |

Para un proyecto personal o pequeño el costo es **$0 – $5 USD/mes**.

---

## Solución de problemas

**Error CORS:** Verifica que `FRONTEND_URL` en Railway coincide exactamente con tu URL de Vercel (sin slash final).

**`DATABASE_URL` no configurada:** En Railway, asegúrate de que el servicio PostgreSQL está en el mismo proyecto y que usas la variable de referencia `${{Postgres.DATABASE_URL}}`.

**Glifos vacíos al exportar:** La imagen del glifo debe tener trazos negros sobre fondo blanco. Aumenta el contraste antes de subir.

**`sharp` falla en Railway:** Railway usa Nixpacks, que instala las dependencias nativas automáticamente. Si falla, agrega `"sharp": { "force": true }` en el `package.json`.
