# Auditoría Arquitectónica de pwaMenu - Concurrencia y Escalabilidad

**Fecha:** 2025-12-27
**Auditor:** Claude Opus 4.5 (Senior Software Architect)
**Proyecto:** pwaMenu - PWA de Menú Digital Compartido

---

## Resumen Ejecutivo

El proyecto pwaMenu presenta una arquitectura cliente bien estructurada con React 19 y Zustand, pero tiene **limitaciones arquitectónicas fundamentales** que afectarán la escalabilidad en producción. El problema más crítico es que el "carrito compartido" no está realmente compartido entre dispositivos.

### Calificación General

| Aspecto | Puntuación | Observación |
|---------|------------|-------------|
| UI/UX Layer | 9/10 | Excelente implementación React 19 |
| State Management | 7/10 | Buenos patrones, faltan guards |
| Concurrencia | 5/10 | Race conditions identificadas |
| Escalabilidad Multi-dispositivo | 2/10 | Requiere backend |

---

## 🔴 Problemas CRÍTICOS (Bloqueantes para Producción)

### 1. Sin Sincronización Multi-Dispositivo

**Ubicación:** `src/stores/tableStore/store.ts:68-80`

**Problema:** Cada dispositivo genera su propia sesión independiente. El "shared_cart" solo existe en localStorage local.

```typescript
// Cada dispositivo crea su propio ID de sesión
session = {
  id: generateId(),  // Único por dispositivo
  table_number: tableNumber,
  diners: [],
  shared_cart: [],
}
```

**Impacto:**
- Diner A en su celular NO ve los items de Diner B en su celular
- El concepto de "carrito compartido" es una ilusión de UI
- Imposible coordinar pedidos entre comensales

**Solución Requerida:**

```
┌──────────────┐     WebSocket      ┌──────────────┐
│  Dispositivo │ ←──────────────→  │   Backend    │
│     A        │                    │   Server     │
└──────────────┘                    └──────────────┘
        ↑                                  ↑
        └──────── Sincronización ─────────┘
                        ↓
               ┌──────────────┐
               │  Dispositivo │
               │     B        │
               └──────────────┘
```

---

### 2. Sin Mutex para Token Refresh

**Ubicación:** `src/stores/authStore.ts:497-545`

**Problema:** Múltiples llamadas API concurrentes pueden disparar refresh de token simultáneo.

```
Request A ──┐
Request B ──┤──→ Todos detectan token expirado
Request C ──┘    ↓
                3 llamadas paralelas a /auth/refresh
                ↓
                Solo 1 tiene éxito (tokens son single-use)
                ↓
                2 requests fallan, posible logout
```

**Solución:** Implementar "refresh promise coalescing":

```typescript
let refreshPromise: Promise<boolean> | null = null

refreshAccessToken: async () => {
  if (refreshPromise) return refreshPromise
  refreshPromise = doRefresh()
  try { return await refreshPromise }
  finally { refreshPromise = null }
}
```

---

## 🟠 Problemas de ALTA Severidad

### 3. Race Condition en useAsync

**Ubicación:** `src/hooks/useAsync.ts:60-85`

**Problema:** Llamadas concurrentes sobrescriben resultados.

```typescript
// Escenario: búsqueda rápida
execute(searchProducts("piz"))  // Request 1 (tarda 500ms)
execute(searchProducts("pizza")) // Request 2 (tarda 200ms)

// Resultado: Request 2 termina primero
// Estado: { data: "pizza results" }
// Luego Request 1 termina
// Estado: { data: "piz results" }  // ¡Incorrecto!
```

**Solución:** Patrón request ID:

```typescript
const requestIdRef = useRef(0)

const execute = useCallback(async (fn) => {
  const currentId = ++requestIdRef.current
  const result = await fn()
  if (currentId !== requestIdRef.current) return // Stale
  setState({ data: result })
}, [])
```

---

### 4. Rollback de submitOrder Puede Restaurar Items Eliminados

**Ubicación:** `src/stores/tableStore/store.ts:302-314`

**Problema:** Si un diner elimina items durante la submisión, el rollback los restaura.

```
T0: Cart = [A, B, C], submitOrder() captura [A,B,C]
T1: Diner elimina item C
T2: submitOrder() falla
T3: Rollback restaura [A, B, C] ← C reaparece incorrectamente
```

**Solución:** Rastrear eliminaciones durante submisión y excluirlas del rollback.

---

### 5. closeTable sin Guard de Submisión Concurrente

**Ubicación:** `src/stores/tableStore/store.ts:347-394`

**Problema:** No hay bloqueo que prevenga `submitOrder()` durante `closeTable()`.

**Solución:**

```typescript
closeTable: async () => {
  const state = get()

  // Agregar este guard
  if (state.isSubmitting) {
    return { success: false, error: 'Order submission in progress' }
  }

  // ... resto del código
}
```

---

## 🟡 Problemas de MEDIA Severidad

### 6. Sesión Expira Solo en Rehidratación

**Ubicación:** `src/stores/tableStore/store.ts:458-468`

**Problema:** Si la app permanece abierta > 8 horas, la sesión "expirada" sigue activa en memoria.

**Solución:** Timer periódico o verificación antes de acciones críticas.

---

### 7. Throttle por product_id, No por Diner

**Ubicación:** `src/stores/tableStore/store.ts:150`

```typescript
if (!shouldExecute(`addToCart-${input.product_id}`, 200))
```

**Impacto:** Si dos diners agregan el mismo producto en < 200ms, el segundo se throttlea.

**Solución:** Incluir diner_id en la key de throttle:

```typescript
if (!shouldExecute(`addToCart-${currentDiner.id}-${input.product_id}`, 200))
```

---

### 8. Sin Request Queue ni Límite de Concurrencia

**Ubicación:** `src/services/api.ts`

**Problema:** Sin límite de requests en vuelo. El browser limita a 6 conexiones por dominio, pero no hay priorización ni cancelación de requests obsoletos.

**Solución:** Implementar request queue con límite de concurrencia y priorización.

---

### 9. Cross-Tab Session Desync

**Ubicación:** `src/stores/authStore.ts:561-575`

**Problema:** `sessionStorage` es por pestaña. Tab A logueado, Tab B deslogueado.

**Solución:** Usar `BroadcastChannel` API para sincronizar estado entre pestañas.

---

### 10. Sin Transición Mock → API Real

**Ubicación:** `src/services/mockData.ts`

**Problema:** Componentes importan mock data directamente. No hay capa de abstracción.

```typescript
// Actual (acoplado)
import { mockProducts } from '../services/mockData'

// Requerido (desacoplado)
import { getProducts } from '../services/productService'
// productService internamente decide mock vs API real
```

---

## 🟢 Patrones POSITIVOS Identificados

| Patrón | Ubicación | Descripción |
|--------|-----------|-------------|
| Request Deduplication | `api.ts:95-113` | Evita requests duplicados con Map |
| Throttle con Cleanup | `helpers.ts:154-215` | Limpia entradas viejas cada 60s |
| Retry con Backoff | `helpers.ts:217-267` | Exponencial + jitter |
| Stable Empty Arrays | `store.ts:29-31` | Previene re-renders innecesarios |
| SSRF Prevention | `api.ts:11-73` | Allowlist de hosts/puertos |
| PWA Caching Strategies | `vite.config.ts:78-186` | CacheFirst/NetworkFirst apropiados |
| Nonce CSRF Protection | `googleAuth.ts:17-79` | Previene replay attacks |
| React 19 useActionState | `ProductDetailModal.tsx`, `CallWaiterModal.tsx`, `JoinTable/index.tsx` | Forms declarativos |
| React 19 useOptimistic | `useOptimisticCart.ts`, `SharedCart.tsx` | Actualizaciones instantáneas |
| Reusable Hooks | `useEscapeKey.ts`, `useAutoCloseTimer.ts` | Código DRY |

---

## Métricas de Escalabilidad

| Aspecto | Estado Actual | Límite Estimado |
|---------|---------------|-----------------|
| Diners por mesa | ✅ Funcional | ~10 (single device) |
| Items en carrito | ✅ Funcional | ~100 (localStorage limit) |
| Órdenes por sesión | ⚠️ Sin límite | ~50 antes de lag notable |
| Mesas concurrentes | ❌ N/A | Requiere backend |
| Dispositivos por mesa | ❌ 1 | Requiere WebSocket |

---

## Arquitectura de Sincronización Requerida

```
                    ┌─────────────────────────────────────┐
                    │           Backend Server            │
                    │  ┌─────────────────────────────┐   │
                    │  │    Table Session Service    │   │
                    │  │  - Session CRUD             │   │
                    │  │  - Cart Operations          │   │
                    │  │  - Order Management         │   │
                    │  └─────────────────────────────┘   │
                    │               │                     │
                    │  ┌────────────┴───────────┐        │
                    │  │    WebSocket Gateway    │        │
                    │  │  - Room per table       │        │
                    │  │  - Broadcast changes    │        │
                    │  │  - Conflict resolution  │        │
                    │  └────────────┬───────────┘        │
                    └───────────────┼─────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
       ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐
       │   Phone A   │       │   Phone B   │       │   Phone C   │
       │   Diner 1   │       │   Diner 2   │       │   Diner 3   │
       │             │       │             │       │             │
       │ ┌─────────┐ │       │ ┌─────────┐ │       │ ┌─────────┐ │
       │ │tableStore│◄───────►│tableStore│◄────────►│tableStore│ │
       │ │(optimistic)│       │(optimistic)│       │(optimistic)│ │
       │ └─────────┘ │       │ └─────────┘ │       │ └─────────┘ │
       └─────────────┘       └─────────────┘       └─────────────┘
```

**Flujo de Sincronización:**
1. Diner A agrega item → Optimistic update local
2. Envía a WebSocket → Backend persiste
3. Backend broadcast a Room → Phones B,C reciben
4. Si conflicto → Backend resuelve (Last Write Wins o Merge)

---

## Recomendaciones Prioritarias

### Fase 1: Correcciones Críticas (Pre-producción)

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Implementar refresh token mutex | 2 horas | P0 |
| Agregar request ID a useAsync | 1 hora | P0 |
| Agregar guard isSubmitting en closeTable | 30 min | P0 |
| Verificar expiración antes de acciones críticas | 1 hora | P1 |

### Fase 2: Backend MVP (Habilitador de Escalabilidad)

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| API REST para sessions/orders | 1 semana | P0 |
| WebSocket para sincronización real-time | 1 semana | P0 |
| Conflict resolution strategy | 2 días | P1 |

### Fase 3: Optimizaciones

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Request queue con priorización | 2 días | P2 |
| Capa de abstracción API/Mock | 1 día | P2 |
| Periodic session expiry check | 2 horas | P2 |

---

## Análisis Detallado por Componente

### tableStore (Estado Principal)

**Archivos analizados:**
- `src/stores/tableStore/store.ts`
- `src/stores/tableStore/helpers.ts`
- `src/stores/tableStore/types.ts`
- `src/stores/tableStore/selectors.ts`

**Fortalezas:**
- Uso correcto de Zustand con persist middleware
- Selectors optimizados para evitar re-renders
- Helpers bien organizados y tipados

**Debilidades:**
- Estado local no sincronizado
- Race conditions en operaciones async
- Sin validación de expiración runtime

---

### authStore (Autenticación)

**Archivo:** `src/stores/authStore.ts`

**Fortalezas:**
- Manejo de pending requests con cleanup
- Nonce-based CSRF protection
- Exponential backoff en retries

**Debilidades:**
- Sin mutex para token refresh
- Cross-tab desync con sessionStorage
- Network errors causan logout inmediato

---

### API Layer (Servicios)

**Archivos:**
- `src/services/api.ts`
- `src/services/googleAuth.ts`
- `src/services/mockData.ts`

**Fortalezas:**
- Request deduplication implementada
- SSRF prevention con allowlist
- Timeout handling con AbortController

**Debilidades:**
- Sin request queue
- Sin retry integrado en api.ts
- Mock data acoplado directamente

---

### Custom Hooks

**Archivos analizados:**
- `src/hooks/useAsync.ts`
- `src/hooks/useOptimisticCart.ts`
- `src/hooks/useCloseTableFlow.ts`
- `src/hooks/useDebounce.ts`
- `src/hooks/useIsMounted.ts`
- `src/hooks/useAutoCloseTimer.ts`
- `src/hooks/useEscapeKey.ts`

**Fortalezas:**
- Hooks reutilizables y bien tipados
- Cleanup correcto en la mayoría

**Debilidades:**
- useAsync sin manejo de concurrencia
- useOptimisticCart con posible stale state
- useCloseTableFlow sin guard de invocación múltiple

---

## Conclusión

El proyecto pwaMenu tiene una **arquitectura cliente sólida** con buenos patrones de React 19, pero **no está listo para producción multi-usuario** debido a la falta de sincronización backend.

**Próximo paso crítico:** Implementar backend con WebSocket para habilitar el verdadero "carrito compartido" entre dispositivos.

---

*Documento generado automáticamente como parte de la auditoría arquitectónica.*
