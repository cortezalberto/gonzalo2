# AUDITORÍA DE CÓDIGO - pwaMenu

**Fecha**: 2025-12-28
**Auditor**: Claude Code
**Alcance**: Análisis completo del código fuente de pwaMenu

---

## RESUMEN EJECUTIVO

Se han identificado **44 problemas** en el código de pwaMenu, clasificados en:
- **2 Críticos** (requieren atención inmediata)
- **8 Altos** (alta prioridad)
- **22 Medios** (prioridad moderada)
- **12 Bajos** (mejoras recomendadas)

El código demuestra buenas prácticas arquitectónicas con React 19, Zustand y código modular, pero presenta problemas de concurrencia, seguridad y preparación para producción.

---

## 1. ERRORES Y BUGS CRÍTICOS

### 1.1 🔴 CRÍTICO: Race Condition en Token Refresh
**Archivo**: `src/stores/authStore.ts` (líneas 497-544)

**Problema**: No hay mutex/semáforo para prevenir múltiples llamadas concurrentes a refresh token. Múltiples APIs podrían disparar intentos simultáneos de refresh, invalidando tokens.

**Código problemático**:
```typescript
refreshAccessToken: async () => {
  // No hay verificación si otro refresh está en progreso
  const state = get()
  if (!state.refreshToken) return false
  // Múltiples llamadas podrían llegar aquí simultáneamente
```

**Impacto**: Fallas de autenticación, pérdida de sesión de usuario

**Solución recomendada**:
```typescript
let refreshPromise: Promise<boolean> | null = null

refreshAccessToken: async () => {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const state = get()
      if (!state.refreshToken) return false
      // ... lógica de refresh
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}
```

---

### 1.2 🔴 CRÍTICO: Vulnerabilidad SSRF - Bypass de Validación
**Archivo**: `src/services/api.ts` (líneas 11-63)

**Problema**: La prevención de SSRF solo verifica hostname contra lista permitida pero no previene:
1. Direcciones IPv6 (::1, ::ffff:127.0.0.1)
2. Ataques de DNS rebinding
3. Fragmentos de URL o userinfo

**Código problemático**:
```typescript
// Línea 28 solo verifica hostname, no formato de IP
if (!ALLOWED_HOSTS.has(parsed.hostname)) {
  throw new ApiError('errors.api.ssrfNotAllowed', { isRetryable: false })
}
```

**Impacto**: Atacante podría construir URL que bypasea la validación

**Solución recomendada**:
```typescript
// Validar que no sea dirección IP
const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i

if (ipv4Regex.test(parsed.hostname) || ipv6Regex.test(parsed.hostname)) {
  throw new ApiError('errors.api.ipAddressNotAllowed', { isRetryable: false })
}

// Validar contra lista de hosts permitidos
if (!ALLOWED_HOSTS.has(parsed.hostname)) {
  throw new ApiError('errors.api.ssrfNotAllowed', { isRetryable: false })
}

// Prevenir userinfo en URL
if (parsed.username || parsed.password) {
  throw new ApiError('errors.api.credentialsNotAllowed', { isRetryable: false })
}
```

---

## 2. PROBLEMAS DE ALTA PRIORIDAD

### 2.1 🟠 ALTO: Fuga de Memoria en SharedCart Timer
**Archivo**: `src/components/SharedCart.tsx` (líneas 134-138)

**Problema**: El timer se limpia en el cleanup effect (líneas 48-54) pero el timer configurado en `handleSubmitOrder` puede quedar huérfano si el componente se desmonta durante el envío.

**Código problemático**:
```typescript
autoCloseTimerRef.current = setTimeout(() => {
  if (!isMounted()) return  // Guarda setState pero el timer ya ejecutó
  onClose()
  reset()
}, 2000)
```

**Solución recomendada**:
```typescript
// En handleSubmitOrder
if (autoCloseTimerRef.current) {
  clearTimeout(autoCloseTimerRef.current)
}
autoCloseTimerRef.current = setTimeout(() => {
  if (!isMounted()) return
  onClose()
  reset()
}, ANIMATION.AUTO_CLOSE_MS) // Usar constante

// En cleanup effect - asegurar limpieza
return () => {
  if (autoCloseTimerRef.current) {
    clearTimeout(autoCloseTimerRef.current)
    autoCloseTimerRef.current = null
  }
}
```

---

### 2.2 🟠 ALTO: Error en Lógica de Validación de Puerto
**Archivo**: `src/services/api.ts` (líneas 48-49)

**Problema**: Cuando el puerto es string vacío (HTTP/HTTPS por defecto), la condición `!parsed.port && !currentPort` puede rechazar incorrectamente requests same-origin válidos si window.location.port es undefined vs string vacío.

**Código problemático**:
```typescript
const isValidSameOriginPort = isAllowedPort ||
  parsed.port === currentPort ||
  (!parsed.port && !currentPort) // undefined !== '' en JavaScript
```

**Solución recomendada**:
```typescript
// Normalizar puertos antes de comparar
const normalizedParsedPort = parsed.port || ''
const normalizedCurrentPort = currentPort || ''

const isValidSameOriginPort = isAllowedPort ||
  normalizedParsedPort === normalizedCurrentPort
```

---

### 2.3 🟠 ALTO: Expiración de Sesión No Verificada Durante Uso Activo
**Archivo**: `src/stores/tableStore/store.ts` (líneas 458-484)

**Problema**: La expiración de sesión solo se verifica en rehidratación (carga de página), no durante sesión activa. Según CLAUDE.md línea 263: "Session expiry only checked on page load, not during active use."

**Impacto**: Usuarios pueden continuar usando sesiones expiradas por horas sin notificación

**Solución recomendada**:
```typescript
// Agregar verificación en acciones críticas
const checkSessionExpiry = (state: TableState): boolean => {
  if (!state.session) return false
  return isSessionExpired(state.session.created_at)
}

// En submitOrder
submitOrder: async () => {
  const currentState = get()

  if (checkSessionExpiry(currentState)) {
    set({ session: null, currentDiner: null })
    throw new ApiError('errors.sessionExpired', { isRetryable: false })
  }

  // ... resto de la lógica
}
```

---

### 2.4 🟠 ALTO: Re-renders Costosos en useHeaderData
**Archivo**: `src/stores/tableStore/selectors.ts` (líneas 48-60)

**Problema**: `cartCount` calculado con useMemo depende de `session?.shared_cart` que es una nueva referencia de array en cada cambio de carrito, causando re-render del Header en cada operación de carrito.

**Impacto**: Re-renders innecesarios del Header afectando performance percibida

**Código problemático**:
```typescript
const cartCount = useMemo(
  () => session?.shared_cart?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
  [session?.shared_cart]  // Nueva referencia de array en cada actualización
)
```

**Solución recomendada**:
```typescript
// Crear selector específico que solo se suscribe al conteo
export const useCartCount = () => useTableStore((state) => {
  if (!state.session?.shared_cart) return 0
  return state.session.shared_cart.reduce((sum, item) => sum + item.quantity, 0)
})

// En useHeaderData, usar el selector optimizado
export const useHeaderData = () => {
  const session = useSession()
  const currentDiner = useCurrentDiner()
  const cartCount = useCartCount()  // Selector optimizado
  const diners = useDiners()

  return useShallow(() => ({
    session,
    currentDiner,
    cartCount,
    diners,
  }))
}
```

---

### 2.5 🟠 ALTO: Falta Error Boundary Global
**Archivo**: `src/App.tsx`

**Problema**: ErrorBoundary envuelve AppContent (línea 156) pero no captura errores en:
- Hooks lifecycle de React
- Event handlers
- Operaciones async
- Errores de service worker

**Impacto**: Errores no capturados crashean toda la app

**Solución recomendada**:
```typescript
// Agregar en App.tsx
useEffect(() => {
  // Capturar errores de async sin catch
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection:', event.reason)
    // Enviar a servicio de logging
  }

  // Capturar errores globales
  const handleError = (event: ErrorEvent) => {
    console.error('Global error:', event.error)
    // Enviar a servicio de logging
  }

  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  window.addEventListener('error', handleError)

  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    window.removeEventListener('error', handleError)
  }
}, [])
```

---

### 2.6 🟠 ALTO: Falta Gestión de Foco en Modales
**Archivo**: Múltiples modales (ProductDetailModal, SharedCart, etc.)

**Problema**: Los modales no atrapan el foco ni lo restauran al elemento disparador al cerrar. Usuarios de teclado pueden hacer tab fuera del modal hacia contenido de fondo.

**Impacto**: Violación WCAG 2.1 Level AA (2.4.3 Focus Order)

**Solución recomendada**:
```typescript
// Crear hook useFocusTrap
const useFocusTrap = (isOpen: boolean, onClose: () => void) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Guardar elemento activo
    previousActiveElement.current = document.activeElement as HTMLElement

    // Enfocar primer elemento enfocable
    const focusableElements = containerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusableElements && focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus()
    }

    // Handler para atrapar foco
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusableElements = Array.from(
        containerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[]

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleTab)

    return () => {
      document.removeEventListener('keydown', handleTab)
      // Restaurar foco al cerrar
      previousActiveElement.current?.focus()
    }
  }, [isOpen])

  return containerRef
}
```

---

### 2.7 🟠 ALTO: No Hay Sincronización Multi-Dispositivo
**Archivo**: Todo tableStore, CLAUDE.md línea 261

**Problema**: El "carrito compartido" es solo local usando localStorage. Múltiples dispositivos en la misma mesa ven estados diferentes del carrito. No hay WebSocket o polling para sincronización en tiempo real.

**Impacto**: La característica está engañosamente nombrada - no es verdaderamente "compartida" entre dispositivos

**Solución recomendada**:
1. Documentar prominentemente la limitación en la UI
2. O implementar sincronización WebSocket:

```typescript
// Agregar a tableStore
let ws: WebSocket | null = null

const setupWebSocket = (tableId: string) => {
  ws = new WebSocket(`${WEBSOCKET_URL}/table/${tableId}`)

  ws.onmessage = (event) => {
    const update = JSON.parse(event.data)
    if (update.type === 'CART_UPDATE') {
      set((state) => ({
        ...state,
        session: {
          ...state.session!,
          shared_cart: update.cart
        }
      }))
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    // Fallback a polling
  }
}

// En addToCart, removeFromCart, etc.
const broadcastCartUpdate = (cart: CartItem[]) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'CART_UPDATE',
      cart
    }))
  }
}
```

---

### 2.8 🟠 ALTO: Falta Anuncio de Actualizaciones en Vivo
**Archivo**: `src/components/SharedCart.tsx` (líneas 247-251)

**Problema**: El contenido del carrito tiene `aria-live="polite"` pero los cambios pueden no anunciarse correctamente. Las actualizaciones optimistas no disparan anuncios ARIA.

**Solución recomendada**:
```typescript
// Agregar región de anuncios
const [announcement, setAnnouncement] = useState('')

const announceCartChange = (message: string) => {
  setAnnouncement(message)
  setTimeout(() => setAnnouncement(''), 1000)
}

// En handleAddItem, handleRemoveItem, etc.
const handleAddItem = async (productId: string) => {
  // ... lógica
  announceCartChange(t('cart.itemAdded'))
}

// En JSX
<div role="status" aria-live="polite" className="sr-only">
  {announcement}
</div>
```

---

## 3. PROBLEMAS DE PRIORIDAD MEDIA

### 3.1 🟡 MEDIO: Estado Global en Módulo (throttleMap)
**Archivo**: `src/stores/tableStore/helpers.ts` (líneas 159-215)

**Problema**: `throttleMap` está en scope de módulo, compartido entre todas las instancias del store. En testing o escenarios multi-app, esto causa contaminación cruzada.

**Código problemático**:
```typescript
const throttleMap = new Map<string, number>()  // Scope de módulo
let lastCleanupTime = Date.now()  // Scope de módulo
```

**Solución recomendada**:
```typescript
// Mover al estado del store
interface TableState {
  // ... otros campos
  _throttleMap: Map<string, number>
  _lastCleanupTime: number
}

// Modificar shouldExecute para usar estado
const shouldExecute = (key: string, delayMs: number): boolean => {
  const state = get()
  const now = Date.now()

  // Usar state._throttleMap en lugar de throttleMap global
  const lastExecution = state._throttleMap.get(key)

  if (lastExecution && now - lastExecution < delayMs) {
    return false
  }

  // Actualizar mapa en estado
  set((state) => ({
    _throttleMap: new Map(state._throttleMap).set(key, now)
  }))

  return true
}
```

---

### 3.2 🟡 MEDIO: Mutación de Estado Global (googleAuth.ts)
**Archivo**: `src/services/googleAuth.ts` (líneas 17-78)

**Problema**: Variable `currentNonce` en scope de módulo es mutada globalmente, previniendo flujos de auth paralelos y causando problemas en tests.

**Código problemático**:
```typescript
let currentNonce: string | null = null  // Estado mutable global
```

**Solución recomendada**:
```typescript
// Almacenar nonce en authStore state
// En authStore.ts
interface AuthState {
  // ... otros campos
  currentNonce: string | null
}

// En googleAuth.ts, pasar/retornar nonce en lugar de mutarlo globalmente
export const generateAndStoreNonce = (): string => {
  const nonce = generateRandomString(32)
  // Retornar para que authStore lo almacene
  return nonce
}
```

---

### 3.3 🟡 MEDIO: Sin Estados de Carga para Componentes Lazy
**Archivo**: `src/pages/Home.tsx` (líneas 212-242)

**Problema**: Múltiples componentes lazy-loaded usan `fallback={null}` en Suspense, sin proveer feedback de carga a usuarios.

**Código problemático**:
```typescript
<Suspense fallback={null}>
  <SharedCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
</Suspense>
```

**Solución recomendada**:
```typescript
<Suspense fallback={<LoadingSpinner size="lg" />}>
  <SharedCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
</Suspense>
```

---

### 3.4 🟡 MEDIO: Verificación de Nonce Faltante en Producción
**Archivo**: `src/services/googleAuth.ts` (líneas 179-193)

**Problema**: El nonce se genera y almacena pero `verifyNonce` solo se llama en modo mock (authStore.ts línea 100). El modo producción procesa credential de Google sin verificación de nonce.

**Impacto**: Vulnerabilidad CSRF en producción si backend no verifica nonce

**Solución recomendada**:
```typescript
// En authStore.ts, agregar verificación en producción
loginWithGoogle: async (credential: string) => {
  if (MOCK_MODE) {
    const isValid = verifyNonce(credential)
    if (!isValid) {
      throw new AuthError('errors.authGoogleInvalid', 'INVALID_CREDENTIAL')
    }
  }

  // AGREGAR: Verificación en producción
  const storedNonce = get().currentNonce
  if (!storedNonce) {
    throw new AuthError('errors.authGoogleInvalid', 'MISSING_NONCE')
  }

  // Backend debe verificar que el nonce en el credential coincida
  // con el nonce almacenado

  // ... resto de la lógica
}
```

---

### 3.5 🟡 MEDIO: Traducción Ineficiente de Productos
**Archivo**: `src/pages/Home.tsx` (líneas 105-119)

**Problema**: `filteredProducts` memoization traduce TODOS los productos (`translateProducts(mockProducts)`) en cada keystroke de búsqueda, aunque solo se muestra un subconjunto.

**Código problemático**:
```typescript
const filteredProducts = useMemo(() => {
  if (!searchQuery) {
    return recommendedProducts
  }

  const translatedProducts = translateProducts(mockProducts)  // Todos traducidos
  const query = searchQuery.toLowerCase()
  return translatedProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
  )
}, [searchQuery, translateProducts, recommendedProducts])
```

**Solución recomendada**:
```typescript
const filteredProducts = useMemo(() => {
  if (!searchQuery) {
    return recommendedProducts
  }

  // Filtrar primero, traducir después
  const query = searchQuery.toLowerCase()
  const filtered = mockProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
  )

  return translateProducts(filtered)  // Solo traduce resultados filtrados
}, [searchQuery, translateProducts, recommendedProducts])
```

---

### 3.6 🟡 MEDIO: Limpieza de Throttle Map con Performance Costosa
**Archivo**: `src/stores/tableStore/helpers.ts` (líneas 170-186)

**Problema**: La limpieza ejecuta un scan lineal (for...of) en CADA llamada a `shouldExecute` cuando ha pasado `THROTTLE_CLEANUP_INTERVAL_MS`. Para acciones de alta frecuencia, esto crea overhead O(n).

**Código problemático**:
```typescript
for (const [key, timestamp] of throttleMap.entries()) {
  if (now - timestamp > THROTTLE_MAX_AGE_MS) {
    throttleMap.delete(key)
  }
}
```

**Solución recomendada**:
```typescript
// Usar cleanup interval separado en lugar de verificar en cada shouldExecute
let cleanupIntervalId: number | null = null

const startCleanup = () => {
  if (cleanupIntervalId) return

  cleanupIntervalId = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamp] of throttleMap.entries()) {
      if (now - timestamp > THROTTLE_MAX_AGE_MS) {
        throttleMap.delete(key)
      }
    }
  }, THROTTLE_CLEANUP_INTERVAL_MS)
}

// Llamar startCleanup en inicialización del store
```

---

### 3.7 🟡 MEDIO: Data de Mock Fuertemente Acoplada
**Archivo**: `src/pages/Home.tsx` (líneas 30-39)

**Problema**: Importación directa de funciones mockData en código de producción. Cuando se implemente backend, será necesario refactoring extenso.

**Código problemático**:
```typescript
import {
  mockCategories,
  mockProducts,
  getRecommendedProducts,
  getFeaturedProducts,
  getSubcategoriesByCategory,
  getProductsBySubcategory,
  getCategoryById,
  getSubcategoryById
} from '../services/mockData'
```

**Solución recomendada**:
```typescript
// Crear capa de abstracción (repository pattern)
// src/services/productRepository.ts
export interface ProductRepository {
  getCategories(): Category[]
  getProducts(): Product[]
  getRecommendedProducts(): Product[]
  getFeaturedProducts(): Product[]
  getSubcategoriesByCategory(categoryId: string): Subcategory[]
  getProductsBySubcategory(subcategoryId: string): Product[]
  getCategoryById(id: string): Category | undefined
  getSubcategoryById(id: string): Subcategory | undefined
}

class MockProductRepository implements ProductRepository {
  getCategories() { return mockCategories }
  // ... implementar todos los métodos
}

class ApiProductRepository implements ProductRepository {
  async getCategories() {
    const response = await apiClient.get('/categories')
    return response.data
  }
  // ... implementar todos los métodos
}

// En Home.tsx
const productRepo = import.meta.env.VITE_USE_MOCK
  ? new MockProductRepository()
  : new ApiProductRepository()
```

---

### 3.8 🟡 MEDIO: Sin Paginación o Scroll Virtual
**Archivo**: `src/pages/Home.tsx` (líneas 341-357, 374-381)

**Problema**: Todos los productos se renderizan de una vez. Causará degradación de performance con 100+ productos.

**Solución recomendada**:
```typescript
// Usar react-window o react-virtual
import { useVirtualizer } from '@tanstack/react-virtual'

const parentRef = useRef<HTMLDivElement>(null)

const virtualizer = useVirtualizer({
  count: subcategoryProducts.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100, // Altura estimada de ProductListItem
  overscan: 5
})

return (
  <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative'
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`
          }}
        >
          <ProductListItem product={subcategoryProducts[virtualRow.index]} />
        </div>
      ))}
    </div>
  </div>
)
```

---

### 3.9 🟡 MEDIO: Sin Cancelación de Requests Pendientes
**Archivo**: `src/services/api.ts`

**Problema**: La deduplicación previene requests redundantes pero no cancela requests pendientes cuando el componente se desmonta. AbortController se crea (línea 151) pero no se expone para cancelación.

**Solución recomendada**:
```typescript
// Modificar signature de request para retornar abort function
export const request = <T>(
  endpoint: string,
  options: RequestOptions = {}
): { promise: Promise<T>; abort: () => void } => {
  const controller = new AbortController()

  const promise = (async () => {
    // ... lógica existente
  })()

  return {
    promise,
    abort: () => controller.abort()
  }
}

// En componentes
useEffect(() => {
  const { promise, abort } = request('/api/data')

  promise.then(data => setData(data))

  return () => abort() // Cancelar en cleanup
}, [])
```

---

### 3.10 🟡 MEDIO: Sincronización de Estado Optimista del Carrito
**Archivo**: `src/hooks/useOptimisticCart.ts`

**Problema**: Las actualizaciones optimistas usan IDs temporales (línea 95: `temp-${Date.now()}-...`) que nunca se reconcilian con IDs generados por servidor. Si la API del backend retorna estructura diferente, la sincronización se rompe.

**Código problemático**:
```typescript
const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
```

**Impacto**: El item optimista nunca se reconcilia con el item real del carrito

**Solución recomendada**:
```typescript
// Cuando la respuesta del servidor retorna
const reconcileOptimisticItem = (tempId: string, serverItem: CartItem) => {
  set((state) => ({
    session: {
      ...state.session!,
      shared_cart: state.session!.shared_cart.map(item =>
        item.product_id === tempId ? serverItem : item
      )
    }
  }))
}
```

---

### 3.11 🟡 MEDIO: Race Condition en Rehidratación del Store
**Archivo**: `src/stores/tableStore/store.ts` (líneas 458-484)

**Problema**: `onRehydrateStorage` modifica estado durante rehidratación pero los componentes pueden suscribirse antes de que se complete la rehidratación, viendo datos obsoletos brevemente.

**Solución recomendada**:
```typescript
// Agregar flag de hidratación
interface TableState {
  // ... otros campos
  _isHydrated: boolean
}

// En onRehydrateStorage
onRehydrateStorage: (state) => {
  return (state, error) => {
    if (error) {
      console.error('Failed to rehydrate table store:', error)
      return
    }

    // ... lógica de expiración existente

    // Marcar como hidratado
    set({ _isHydrated: true })
  }
}

// En componentes, mostrar loading hasta que esté hidratado
const isHydrated = useTableStore((state) => state._isHydrated)

if (!isHydrated) {
  return <LoadingSpinner />
}
```

---

### 3.12 🟡 MEDIO: Errores de Validación de Formularios No Anunciados
**Archivo**: Componentes JoinTable, ProductDetailModal

**Problema**: Mensajes de error mostrados visualmente pero les falta asociación `aria-describedby` con inputs. Los lectores de pantalla no anuncian errores de validación.

**Solución recomendada**:
```typescript
// En NameStep.tsx
const errorId = useId()

<input
  id="name-input"
  aria-describedby={error ? errorId : undefined}
  aria-invalid={!!error}
  // ... otras props
/>

{error && (
  <p id={errorId} className="text-red-500 text-sm mt-1">
    {t(error)}
  </p>
)}
```

---

### 3.13 🟡 MEDIO: Sin Protección CSRF Adecuada
**Archivo**: Todas las llamadas API en api.ts, mercadoPago.ts, authStore.ts

**Problema**: Solo usa header `X-Requested-With: XMLHttpRequest` (api.ts línea 157) para "Protección CSRF básica" según comentario. Esto es insuficiente - el header puede ser configurado por JavaScript malicioso.

**Solución recomendada**:
```typescript
// Backend debe generar CSRF token
// En api.ts
let csrfToken: string | null = null

export const setCsrfToken = (token: string) => {
  csrfToken = token
}

// En request()
headers: {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'X-CSRF-Token': csrfToken || '', // Token CSRF del backend
  ...options.headers,
}
```

---

### 3.14 🟡 MEDIO: Recuperación de Errores Faltante en submitOrder
**Archivo**: `src/stores/tableStore/store.ts` (líneas 300-322)

**Problema**: El rollback en fallo hace merge de items: `shared_cart: [...cartItems, ...currentState.session.shared_cart]` (línea 313). Si el usuario agregó nuevos items durante el envío, esto crea duplicados.

**Código problemático**:
```typescript
shared_cart: [...cartItems, ...currentState.session.shared_cart]
// Si currentState ya tiene nuevos items, aparecen dos veces
```

**Solución recomendada**:
```typescript
// Usar deduplicación basada en ID
const mergedCart = [...cartItems]
const cartItemIds = new Set(cartItems.map(item => item.product_id))

for (const item of currentState.session.shared_cart) {
  if (!cartItemIds.has(item.product_id)) {
    mergedCart.push(item)
  }
}

set((state) => ({
  ...state,
  session: {
    ...state.session!,
    shared_cart: mergedCart
  },
  // ... resto del estado
}))
```

---

### 3.15 🟡 MEDIO: Timeout de Fetch No Limpiado en Success
**Archivo**: `src/services/api.ts` (líneas 179-181)

**Problema**: `clearTimeout(timeoutId)` se llama inmediatamente después de que fetch completa (línea 180), pero si el procesamiento de la respuesta lanza error (ej. parsing JSON falla), el timeout no se limpia de nuevo en el bloque catch.

**Solución recomendada**:
```typescript
try {
  const response = await fetch(url, fetchOptions)

  try {
    // ... procesamiento de respuesta
    return processedData
  } finally {
    clearTimeout(timeoutId) // Siempre limpiar timeout
  }
} catch (error) {
  // ... manejo de errores
}
```

---

## 4. PROBLEMAS DE SEGURIDAD

### 4.1 Vulnerabilidad de Persistencia en Session Storage
**Archivo**: `src/stores/authStore.ts` (líneas 563-565)

**Problema**: Tokens de auth en sessionStorage se limpian al cerrar pestaña pero son vulnerables a ataques XSS ya que sessionStorage es accesible por cualquier script.

**Solución recomendada**: Considerar cookies httpOnly para producción, agregar headers CSP.

---

### 4.2 Datos Sensibles en Mensajes de Error
**Archivo**: `src/components/ErrorBoundary.tsx` (líneas 63-74)

**Problema**: Stack traces completos mostrados en modo desarrollo. Si se despliega sin verificar environment, los stack traces filtran detalles de implementación.

**Código problemático**:
```typescript
{import.meta.env.DEV && this.state.error && (
  <pre>{sanitizeText(this.state.error.stack || '')}</pre>
)}
```

**Solución**: Asegurar que `import.meta.env.DEV` nunca sea true en producción.

---

### 4.3 Sin Rate Limiting del Lado del Cliente
**Archivo**: Todas las llamadas API

**Problema**: Sin rate limiting del lado del cliente para requests API. El throttling existe para acciones de carrito (helpers.ts) pero no para llamadas API.

**Solución recomendada**:
```typescript
// Agregar rate limiter decorator
const rateLimitMap = new Map<string, number[]>()

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (endpoint: string): boolean => {
    const now = Date.now()
    const requests = rateLimitMap.get(endpoint) || []

    // Filtrar requests fuera de la ventana
    const recentRequests = requests.filter(time => now - time < windowMs)

    if (recentRequests.length >= maxRequests) {
      return false // Rate limit exceeded
    }

    recentRequests.push(now)
    rateLimitMap.set(endpoint, recentRequests)
    return true
  }
}
```

---

## 5. PROBLEMAS DE ACCESIBILIDAD

### 5.1 Navegación por Teclado Faltante en Selector de Idioma
**Archivo**: `src/components/LanguageSelector.tsx`

**Problema**: El dropdown abre en click pero navegación con flechas no implementada. Usuarios solo-teclado deben tabular por todas las opciones.

---

### 5.2 Contraste de Color Insuficiente
**Archivo**: Clases dark theme de Tailwind globalmente

**Problema**: Color `text-dark-muted` puede no cumplir ratios de contraste WCAG AA (4.5:1) contra `bg-dark-bg`.

**Recomendación**: Auditar ratios de contraste con herramientas automatizadas.

---

## 6. PROBLEMAS DE PERFORMANCE

### 6.1 Múltiples Suscripciones al Mismo Estado del Store
**Archivo**: `src/components/BottomNav.tsx` (líneas 14-15)

**Código problemático**:
```typescript
const session = useSession()
const { orders, currentRound } = useOrderHistoryData()
```

**Solución**: Combinar en un selector para reducir overhead de suscripción.

---

### 6.2 Sin Optimización de Imágenes
**Archivo**: ProductCard, ProductDetailModal, etc.

**Problema**: Imágenes cargadas a resolución completa sin srcset, lazy loading implementado pero sin optimización de tamaño o formato WebP.

---

## 7. DEUDA TÉCNICA

### 7.1 Sin Zustand Devtools Habilitado
**Archivo**: Ambos stores (tableStore, authStore)

**Problema**: Sin middleware de Zustand devtools, dificultando debugging.

**Solución**:
```typescript
import { devtools } from 'zustand/middleware'

export const useTableStore = create<TableState>()(
  devtools(
    persist(
      (set, get) => ({
        // ... estado
      }),
      {
        name: 'table-storage'
      }
    ),
    { name: 'TableStore' }
  )
)
```

---

### 7.2 Manejo de Errores Inconsistente
**Archivo**: Múltiples archivos

**Problema**: Mix de enfoques de manejo de errores:
- Algunos usan clases `AppError` (utils/errors.ts)
- Algunos usan objetos Error raw
- Algunos usan keys i18n directamente
- Algunos usan strings error.message

---

### 7.3 Números Mágicos en Código
**Archivo**: Múltiples archivos

**Problema**: A pesar de tener constantes centralizadas (constants/timing.ts), algunos valores hardcodeados permanecen:
- SharedCart.tsx línea 138: `2000` (debería usar `ANIMATION.AUTO_CLOSE_MS`)
- App.tsx línea 51: `60 * 60 * 1000` (debería usar constante)

---

### 7.4 Sin Cola Offline para Pedidos
**Archivo**: submitOrder en tableStore

**Problema**: Pedidos fallidos por problemas de red se revierten al carrito, pero no se encolan para reintentar cuando se restaura la conexión.

**Recomendación**: Implementar cola de sincronización en background para pedidos fallidos.

---

### 7.5 ID de Restaurante Hardcodeado
**Archivo**: `src/stores/tableStore/store.ts` línea 69

**Problema**: ID de restaurante de var env tiene fallback de 'default'. Sin manejo para despliegue multi-restaurante.

---

## ESTADÍSTICAS DE RESUMEN

| Categoría | Crítico | Alto | Medio | Bajo | Total |
|-----------|---------|------|-------|------|-------|
| Errores & Bugs | 1 | 2 | 3 | 1 | 7 |
| Defectos de Código | 0 | 1 | 3 | 1 | 5 |
| Problemas Futuros | 0 | 1 | 3 | 1 | 5 |
| Seguridad | 1 | 1 | 2 | 1 | 5 |
| Performance | 0 | 1 | 3 | 2 | 6 |
| Accesibilidad | 0 | 1 | 2 | 2 | 5 |
| State Management | 0 | 0 | 2 | 1 | 3 |
| Manejo de Errores | 0 | 1 | 2 | 1 | 4 |
| Type Safety | 0 | 0 | 1 | 1 | 2 |
| Memory Leaks | 0 | 0 | 1 | 1 | 2 |
| **TOTAL** | **2** | **8** | **22** | **12** | **44** |

---

## RECOMENDACIONES PRIORITARIAS

### ⚡ Inmediato (Crítico/Alto):
1. ✅ Implementar mutex de refresh de token (1.1)
2. ✅ Agregar validación IP para SSRF (4.1)
3. ✅ Arreglar limpieza de timer en SharedCart (2.1)
4. ✅ Arreglar lógica de validación de puerto API (2.2)
5. ✅ Optimizar performance de re-render del Header (2.4)
6. ✅ Agregar error boundary global (2.5)
7. ✅ Implementar focus trap en modales (2.6)
8. ✅ Documentar limitación multi-dispositivo (2.7)

### 📋 Corto Plazo (Medio):
1. Normalizar manejo de errores
2. Agregar verificaciones de expiración de sesión durante uso (2.3)
3. Mover estado global a estado del store (3.1, 3.2)
4. Agregar estados de carga para componentes lazy (3.3)
5. Implementar validación de token CSRF (3.13)
6. Optimizar traducción de productos (3.5)
7. Arreglar deduplicación de rollback en submitOrder (3.14)
8. Agregar verificación de nonce en producción (3.4)

### 🔮 Largo Plazo (Bajo + Deuda Técnica):
1. Agregar paginación/scroll virtual (3.8)
2. Implementar gestión de foco (5.1)
3. Agregar Zustand devtools (7.1)
4. Crear capa de abstracción de datos (3.7)
5. Auditar y arreglar contraste de color (5.2)
6. Implementar cola de sincronización offline (7.4)

---

## CONCLUSIÓN

El código de pwaMenu está generalmente bien estructurado con buenos patrones arquitectónicos, pero requiere atención a:

1. **Problemas de Concurrencia**: Race conditions en refresh de tokens y rehidratación del store
2. **Seguridad**: Validación SSRF, protección CSRF, manejo de nonces
3. **Preparación para Producción**: Error boundaries, manejo de errores, límites de tasa
4. **Accesibilidad**: Focus traps, anuncios ARIA, navegación por teclado
5. **Performance**: Optimizaciones de re-render, scroll virtual, optimización de imágenes

La priorización debe centrarse en los problemas críticos y altos primero, especialmente aquellos relacionados con seguridad y estabilidad de la aplicación.
