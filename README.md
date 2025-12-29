# Sabor - Menú Digital Compartido

Una Progressive Web App (PWA) para menús digitales de restaurantes con carrito compartido, división de cuenta y pagos con Mercado Pago.

## Descripción

**Sabor** permite a los comensales de una mesa ordenar colaborativamente desde un carrito compartido, dividir la cuenta y pagar directamente desde sus dispositivos móviles. Diseñada para uso offline-first en dispositivos móviles.

## Características Principales

### Para Comensales
- **Escaneo de QR** - Unirse a una mesa escaneando el código QR
- **Carrito Compartido** - Todos los comensales agregan al mismo carrito
- **Menú Interactivo** - Navegación por categorías, subcategorías y productos
- **Búsqueda** - Buscar productos por nombre o descripción
- **Información de Alérgenos** - Ver alérgenos de cada producto
- **Notas Personalizadas** - Agregar notas especiales a cada pedido
- **Historial de Pedidos** - Ver todas las rondas de pedidos
- **División de Cuenta** - Dividir en partes iguales o por consumo
- **Pago con Mercado Pago** - Pagar directamente desde la app
- **Asistente IA** - Recomendaciones personalizadas

### Técnicas
- **PWA Offline-First** - Funciona sin conexión
- **Multiidioma** - Español, Inglés y Portugués
- **Actualizaciones Automáticas** - Notificación de nuevas versiones
- **Diseño Responsivo** - Optimizado para móvil y escritorio

## Flujo de Usuario

```
1. QR Simulator      → Seleccionar/escanear mesa
2. JoinTable         → Ingresar número de mesa y nombre (opcional)
3. Home              → Navegar menú, agregar productos al carrito
4. SharedCart        → Revisar carrito, enviar pedido
5. (Repetir 3-4)     → Múltiples rondas de pedidos
6. CloseTable        → Revisar cuenta, seleccionar método de división
7. CloseStatusView   → Solicitar cuenta, seleccionar método de pago
8. PaymentResult     → Resultado del pago (Mercado Pago)
9. PaidView          → Dejar mesa, fin de sesión
```

## Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd pwaMenu

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## Comandos

```bash
npm run dev      # Servidor de desarrollo (puerto 5176)
npm run build    # Build de producción
npm run preview  # Preview del build
npm run lint     # Ejecutar ESLint
npx tsc --noEmit # Verificar tipos TypeScript
```

## Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```bash
VITE_API_URL=              # URL del backend API
VITE_RESTAURANT_ID=        # ID del restaurante (default: "default")
VITE_MP_PUBLIC_KEY=        # Mercado Pago public key (TEST-xxx o APP_USR-xxx)
```

## Arquitectura

### Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 19 | UI Framework |
| TypeScript | 5.9 | Tipado estático |
| Vite | 7 | Build tool |
| Tailwind CSS | 4 | Estilos |
| Zustand | 5 | State management |
| i18next | - | Internacionalización |
| vite-plugin-pwa | - | Service Worker |
| Mercado Pago | - | Pagos |

### Estructura de Carpetas

```
src/
├── pages/                    # Páginas principales
│   ├── Home.tsx             # Menú y navegación
│   ├── CloseTable.tsx       # División de cuenta
│   └── PaymentResult.tsx    # Resultado de pago MP
├── components/
│   ├── JoinTable/           # Flujo de unirse a mesa
│   ├── AIChat/              # Asistente IA
│   ├── close-table/         # Componentes de cierre
│   ├── cart/                # Componentes del carrito
│   ├── ui/                  # Primitivos UI
│   └── [otros]              # Header, BottomNav, etc.
├── stores/
│   └── tableStore/          # Estado de sesión/carrito/pedidos
├── hooks/                   # Custom hooks
├── services/                # API, Pagos
├── types/                   # Interfaces TypeScript
├── i18n/                    # Configuración i18n
├── constants/               # Constantes y timing
└── utils/                   # Logger, validación, errores
```

## Estado (Zustand)

### tableStore

Maneja toda la lógica de sesión, carrito y pedidos.

**Estado:**
- `session` - Sesión actual (mesa, comensales, carrito)
- `currentDiner` - Comensal actual
- `orders` - Historial de pedidos
- `currentRound` - Número de ronda actual

**Acciones principales:**
- `joinTable()` - Unirse a una mesa
- `addToCart()` - Agregar producto al carrito
- `submitOrder()` - Enviar pedido (con rollback optimista)
- `closeTable()` - Solicitar cuenta
- `getPaymentShares()` - Calcular división de cuenta
- `leaveTable()` - Abandonar mesa

**Persistencia:** localStorage con expiración de 8 horas

## Componentes Principales

### Páginas

| Componente | Descripción |
|------------|-------------|
| `Home` | Menú principal con categorías, búsqueda y carrito |
| `CloseTable` | División de cuenta y solicitud de pago |
| `PaymentResult` | Procesa respuesta de Mercado Pago |

### Flujo de Unirse

| Componente | Descripción |
|------------|-------------|
| `QRSimulator` | Pantalla inicial para seleccionar mesa |
| `JoinTable` | Contenedor del flujo |
| `TableNumberStep` | Ingreso de número de mesa |
| `NameStep` | Ingreso de nombre (opcional) |

### Carrito

| Componente | Descripción |
|------------|-------------|
| `SharedCart` | Modal del carrito compartido |
| `CartItemCard` | Item individual con controles de cantidad |
| `CartEmpty` | Estado vacío del carrito |
| `OrderSuccess` | Animación de pedido exitoso |

### Cierre de Mesa

| Componente | Descripción |
|------------|-------------|
| `CloseStatusView` | Estados de solicitud de cuenta |
| `SummaryTab` | Resumen por comensal |
| `OrdersList` | Historial de rondas |
| `PaidView` | Pantalla de "Gracias" |

### Menú

| Componente | Descripción |
|------------|-------------|
| `CategoryTabs` | Pestañas de categorías |
| `SubcategoryGrid` | Grid de subcategorías |
| `ProductCard` | Tarjeta de producto (grid) |
| `ProductListItem` | Item de producto (lista) |
| `ProductDetailModal` | Modal con detalle completo |
| `FeaturedCarousel` | Carrusel de destacados |

## Custom Hooks

| Hook | Propósito |
|------|-----------|
| `useOptimisticCart` | Updates optimistas del carrito con React 19 |
| `useAsync` | Manejo de estado async (loading, error, success) |
| `useAutoCloseTimer` | Auto-cerrar modales después de delay |
| `useEscapeKey` | Handler de tecla Escape |
| `useDebounce` | Debounce para búsqueda |
| `useIsMounted` | Verificar si componente está montado |
| `useModal` | Estado de apertura/cierre de modal |
| `useOnlineStatus` | Detectar conectividad de red |
| `useCloseTableFlow` | Flujo multi-paso de cierre |
| `useProductTranslation` | Traducción de productos |
| `useAriaAnnounce` | Anuncios ARIA para lectores de pantalla |

## Servicios

### API (`services/api.ts`)

Cliente HTTP con:
- Prevención de SSRF (validación de hosts, bloqueo de IPs y credenciales en URL)
- Deduplicación de requests en vuelo
- Retry con backoff exponencial
- Headers CSRF

### Mercado Pago (`services/mercadoPago.ts`)

- Creación de preferencias de pago
- Parsing de respuesta de callback
- Modo sandbox vs producción
- Formateo de moneda

## Internacionalización

Idiomas soportados:
- **Español (es)** - Idioma principal
- **Inglés (en)** - Fallback a español
- **Portugués (pt)** - Fallback a español

Uso:
```tsx
const { t } = useTranslation()
return <p>{t('cart.empty')}</p>
```

## PWA y Service Worker

### Manifest
- Nombre: "Sabor - Menú Digital"
- Display: `standalone`
- Theme: Orange (#f97316)
- Icons: 192x192, 512x512

### Estrategias de Cache
1. **CacheFirst** - Imágenes (30 días), fuentes (1 año)
2. **NetworkFirst** - APIs con timeout fallback
3. **SPA Fallback** - `index.html` para navegación offline

### Configuración
```javascript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    navigateFallback: '/index.html'
  }
})
```

## Flujo de Pago (Mercado Pago)

```
1. Usuario selecciona "Mercado Pago" en CloseStatusView
2. Se crea preferencia de pago vía backend
3. Redirect a checkout de MP (sandbox o producción)
4. MP redirige a /payment/success con params
5. PaymentResult.tsx parsea y muestra resultado
6. Usuario puede "Dejar mesa" o "Reintentar"
```

## División de Cuenta

### Métodos Disponibles

| Método | Descripción |
|--------|-------------|
| `equal` | Total ÷ número de comensales |
| `by_consumption` | Suma de items de cada comensal |

### Cálculo
```typescript
function calculatePaymentShares(
  orders: OrderRecord[],
  diners: Diner[],
  method: 'equal' | 'by_consumption'
): PaymentShare[]
```

## Patrones de React 19

### useActionState
```tsx
const [formState, formAction, isPending] = useActionState(
  async (prevState, formData) => {
    // Procesar form
    return { ...prevState, result }
  },
  initialState
)

<form action={formAction}>
  <input name="field" disabled={isPending} />
</form>
```

### useOptimistic
```tsx
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, newItem) => [...state, newItem]
)
```

## Convenciones

### Código
- TypeScript strict mode
- Comentarios en inglés
- Imports relativos (sin aliases)
- Variables no usadas con prefijo `_`

### Estilos
- Tailwind CSS con clases dark mode
- Colores: `dark-bg`, `dark-card`, `dark-muted`, `dark-border`
- Color primario: Orange (#f97316)
- Safe areas para notch de móviles

### Mobile Viewport
Todos los contenedores de página deben incluir:
```tsx
<div className="min-h-screen bg-dark-bg overflow-x-hidden w-full max-w-full">
```

### Logging
```typescript
import { tableStoreLogger } from '../utils/logger'
tableStoreLogger.info('Mensaje', { data })
```

### Errores
```typescript
throw new ApiError('Message', statusCode, ERROR_CODES.TIMEOUT)
// En componente:
{error && <p>{t(error.i18nKey)}</p>}
```

## Limitaciones Conocidas

1. **Sin sincronización multi-dispositivo** - El carrito "compartido" es local; requiere WebSocket para sincronización real

## Despliegue

Configurado para **Vercel** via `vercel.json`:

```bash
# Build
npm run build

# El directorio dist/ contiene los archivos estáticos
```

## Licencia

Privado - Todos los derechos reservados
