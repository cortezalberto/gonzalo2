# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**El Buen Sabor** is a Progressive Web App for shared digital restaurant menus. Diners at a table collaboratively order from a shared cart, split bills, pay via Mercado Pago, and manage table sessions. Built for offline-first mobile use.

## Build & Development Commands

```bash
npm run dev      # Start Vite dev server (port 5176)
npm run build    # Production build
npm run lint     # Run ESLint
npx tsc --noEmit # Type check without emitting
npm run preview  # Preview production build
```

No test framework is configured. Deployment: Vercel (configured via `vercel.json`)

## Technology Stack

- **React 19** with TypeScript 5.9 (strict mode)
- **Vite 7** with Tailwind CSS v4
- **Zustand 5** for state management (with localStorage/sessionStorage persistence)
- **i18next** for internationalization (es, en, pt)
- **vite-plugin-pwa** with Workbox service workers
- **Google OAuth** for authentication (uses `MOCK_MODE` in authStore - enabled in dev, disabled when `VITE_MOCK_AUTH=false`)
- **Mercado Pago** Checkout Pro integration for payments (mock mode in dev without credentials)

## Architecture

### Data Model

Menu structure uses a three-level hierarchy:
- **Categories** (Food, Drinks, Desserts) → **Subcategories** (Burgers, Pasta, Beer, etc.) → **Products**
- Products link to subcategories via `subcategory_id` and categories via `category_id`
- Navigation: Category tabs → Subcategory grid → Product list

### State Management

Two Zustand stores with persistence:

- **tableStore/** (modular) - Session, cart, orders, payment calculations. Uses localStorage with 8-hour expiry. No cross-store imports (auth context passed as parameter).
  - `store.ts` - Main Zustand store with optimistic rollback on `submitOrder()` failure
  - `selectors.ts` - React hooks with `useMemo` for derived values, `useShallow` for object selectors, and stable empty array constants (`EMPTY_CART_ITEMS`, `EMPTY_DINERS`)
  - `helpers.ts` - Pure utility functions (`calculatePaymentShares`, `withRetry`, `shouldExecute` for throttling)
  - `types.ts` - TypeScript interfaces
- **authStore.ts** - Google OAuth state. Uses sessionStorage. `MOCK_MODE` auto-enabled in dev mode. Pending requests tracked inside store state (not module scope) to prevent memory leaks.

**Critical Zustand patterns to avoid infinite re-renders:**
- Selectors returning objects must use `useShallow` from `zustand/react/shallow`
- Derived values (reduce, filter, map) must be computed with `useMemo` inside the hook, NOT inside the selector
- See `useHeaderData`, `useSharedCartData`, `useOrderHistoryData` for correct patterns

### React 19 Patterns

This project leverages React 19 features:

- **useActionState** - Form handling with automatic pending state (`ProductDetailModal`, `CallWaiterModal`, `JoinTable`, `AIChat`)
- **useOptimistic** - Instant UI feedback with automatic rollback (`useOptimisticCart` hook)
- **useTransition** - Non-blocking UI updates for cart operations
- **useId** - Unique IDs for accessibility (`SearchBar`, `SharedCart`)
- **`<form action>`** - Declarative form submission pattern
- **Document metadata** - `<title>` and `<meta>` in component JSX (`Home.tsx`)

**useActionState pattern:**
```typescript
const [formState, formAction, isPending] = useActionState(
  async (prevState, formData) => {
    const value = formData.get('field')
    // Process and return new state
    return { ...prevState, result }
  },
  { status: 'idle', error: null }
)

// In JSX:
<form action={formAction}>
  <input name="field" disabled={isPending} />
</form>
```

### Key Patterns

- **Lazy loading** - Components below the fold use `React.lazy()` with Suspense
- **Optimistic updates** - `useOptimisticCart` hook uses React 19's `useOptimistic` for instant cart feedback
- **Request deduplication** - API client deduplicates identical in-flight requests
- **Mount guards** - Use `useIsMounted` hook in async operations to prevent state updates after unmount
- **Ref pattern for callbacks** - Use `useRef` + `useEffect` to avoid stale closures in timeouts (see `ProductDetailModal`, `CallWaiterModal`)
- **Functional state updates** - Async store actions use `set((state) => ...)` to avoid stale state after `await`
- **Retry with backoff** - Use `withRetry` from `tableStore/helpers.ts` for API calls with exponential backoff
- **Throttling** - Use `shouldExecute(key, delayMs)` from helpers.ts to prevent rapid successive calls (cart actions use 100-200ms)
- **Secure ID generation** - Use `crypto.randomUUID()` via `generateId()` helper
- **Module loggers** - Use `utils/logger.ts` with module prefixes (e.g., `tableStoreLogger`)
- **Modular components** - Complex components use folder structure with `index.tsx` and subcomponents (JoinTable/, AIChat/, tableStore/)

### Custom Hooks

Located in `src/hooks/`:

| Hook | Purpose |
|------|---------|
| `useOptimisticCart` | React 19 optimistic updates for cart with rollback |
| `useAsync` | Async operation state management (loading, error, success) |
| `useAutoCloseTimer` | Auto-close modals after delay with mount safety |
| `useEscapeKey` | Keyboard escape handler with disabled state |
| `useDebounce` | Value debouncing for search inputs |
| `useIsMounted` | Mount state check for async operations |
| `useModal` | Modal open/close state with data |
| `useOnlineStatus` | Network connectivity detection |
| `useCloseTableFlow` | Multi-step table closing flow state |
| `useProductTranslation` | Product name/description i18n |

### Centralized Constants

All timing values are in `src/constants/timing.ts`:

- `ANIMATION` - Modal durations, auto-close delays
- `SESSION` - Expiry hours, stale threshold
- `THROTTLE` - Cart action delays, cleanup intervals
- `AUTH` - Token buffer, retry delays
- `QUANTITY` - Min/max product quantities

**Always import from constants instead of using magic numbers.**

### Security

- **SSRF prevention** - API base URL validated against allowed hosts from `constants/index.ts` (`API_CONFIG.ALLOWED_HOSTS`)
- **CSRF protection** - `X-Requested-With` header on all API calls
- **Token storage** - OAuth tokens in sessionStorage (not localStorage)

### Service Worker Caching

Three strategies in `vite.config.ts`:
1. **CacheFirst** - Images (30d), fonts (1y)
2. **NetworkFirst** - APIs with timeout fallback
3. **SPA fallback** - Navigates to index.html offline

## Key Directories

```
src/
├── pages/           # Home.tsx (menu), CloseTable.tsx (bill splitting), PaymentResult.tsx (MP return)
├── components/      # UI components, ui/ subdirectory for primitives
│   ├── JoinTable/   # Modular - TableNumberStep, NameStep, AuthenticatedUserCard
│   ├── AIChat/      # Modular - responseHandlers.ts with strategy pattern
│   ├── cart/        # Cart components (CartEmpty, CartItemCard, OrderSuccess)
│   ├── close-table/ # Bill splitting (modular: CloseTableHeader, TotalCard, SummaryTab, OrdersList)
│   └── ui/          # Primitives (Modal, LoadingSpinner, SectionErrorBoundary, ErrorAlert)
├── stores/          # Zustand stores
│   └── tableStore/  # Modular store structure
├── hooks/           # Custom hooks (useOptimisticCart, useAsync, useEscapeKey, etc.)
├── services/        # API client, mock data, Google auth, Mercado Pago
├── types/           # TypeScript interfaces (modular: restaurant, catalog, session, auth, ui)
├── i18n/            # i18next config and locale JSON files
├── constants/       # App constants and timing values
└── utils/           # Logger, validation helpers, unified errors (AppError, ApiError, AuthError)
```

## Core Conventions

### TypeScript

- Strict mode enabled with noUnusedLocals/noUnusedParameters
- Unused variables prefixed with underscore are allowed
- All imports use relative paths (no aliases)
- Use explicit generics when TypeScript inference fails with literal constants: `useState<number>(CONSTANT)`

### Styling

- Tailwind utilities with dark mode classes (`dark-bg`, `dark-card`, `dark-muted`, `dark-border`, `dark-elevated`)
- Primary color: Orange (`#f97316`)
- Safe area classes for mobile notch support (`safe-area-top`, `safe-area-bottom`)

### Mobile Viewport

All page/view containers must include `overflow-x-hidden w-full max-w-full` to prevent horizontal scroll on mobile:

```tsx
<div className="min-h-screen bg-dark-bg overflow-x-hidden w-full max-w-full">
```

Global overflow prevention is also applied in `index.css` on `html`, `body`, and `#root`.

### Internationalization

- Always use `useTranslation` hook, never hardcode strings
- Add keys to all three locales (es.json, en.json, pt.json)
- Spanish is the most complete, English/Portuguese fall back to it
- Error messages use i18n keys (e.g., `errors.timeout`, `errors.authGoogleInvalid`) - store the key, display via `t(errorKey)`

### State Updates

- Use Zustand selectors, not direct store access in components
- Selectors prevent unnecessary re-renders on unrelated state changes

### Error Handling

- Use unified error classes from `utils/errors.ts`: `AppError` (base), `ApiError`, `AuthError`, `ValidationError`
- All errors have `code`, `i18nKey`, and `isRetryable` properties
- API errors map legacy codes via `API_ERROR_CODES` for backwards compatibility
- Use `SectionErrorBoundary` for granular error recovery (allows retry without full page crash)

### Logging

- Always use centralized logger from `utils/logger.ts`, never `console.log/warn/error`
- Pre-configured module loggers: `tableStoreLogger`, `authStoreLogger`, `apiLogger`, `googleAuthLogger`, `errorBoundaryLogger`, `joinTableLogger`
- Create new module loggers: `const myLogger = logger.module('ModuleName')`

### Code Comments

- All comments must be in English

### Input Validation

- Use validation helpers from `utils/validation.ts`: `validateTableNumber`, `validateDinerName`, `validateImageUrl`, `sanitizeText`
- Validation functions return i18n keys (e.g., `validation.tableRequired`) - use `t(error, errorParams)` to translate
- Cart operations validate price (positive finite number) and quantity (integer 1-99)
- Local fallback images in `public/` for offline support (`fallback-product.svg`, `default-avatar.svg`)

### Accessibility

- Modals must have `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the title
- Add `aria-hidden="true"` to decorative SVG icons inside buttons with `aria-label`
- Use `useEscapeKey` hook for keyboard dismissal (supports `disabled` state during async operations)
- Use `useId()` for form label/input associations

## Environment Variables

```bash
VITE_API_URL=          # Backend API endpoint
VITE_GOOGLE_CLIENT_ID= # Google OAuth Client ID
VITE_RESTAURANT_ID=    # Restaurant identifier (default: "default")
VITE_MOCK_AUTH=        # Set to "false" to disable mock auth in production
VITE_MP_PUBLIC_KEY=    # Mercado Pago public key (TEST-xxx for sandbox, APP_USR-xxx for production)
```

## Table Session Flow

1. QR scan → JoinTable → enter table number & name
2. Home → browse products, manage shared cart
3. Submit orders → creates OrderRecord (rounds)
4. CloseTable → split bill (equal, by consumption, custom)
5. Payment → choose method (Mercado Pago, card, cash) → PaymentResult page handles MP redirect
6. Leave → session reset

### Mercado Pago Payment Flow

1. User selects Mercado Pago in `CloseStatusView` (bill_ready state)
2. `mercadoPago.ts` creates preference via backend API (or mock in dev)
3. Redirect to MP checkout (`sandbox_init_point` for test, `init_point` for prod)
4. MP redirects back to `/payment/success` with query params
5. `PaymentResult.tsx` parses params and shows approved/pending/rejected state
6. User leaves table or retries

## Known Architectural Limitations

See `auditoria1.md` for detailed analysis. Key points:

- **No multi-device sync** - "Shared cart" is local-only; requires backend WebSocket for true sharing
- **No token refresh mutex** - Concurrent API calls may trigger multiple refresh attempts
- Session expiry only checked on page load, not during active use
