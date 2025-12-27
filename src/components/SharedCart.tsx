import { useMemo, useRef, useCallback, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useSharedCartData, useCartActions, useTableStore } from '../stores/tableStore'
import { useAsync, useIsMounted, useOptimisticCart, useEscapeKey } from '../hooks'
import LoadingSpinner from './ui/LoadingSpinner'
import ErrorAlert from './ui/ErrorAlert'
import { CartEmpty, OrderSuccess, CartItemCard } from './cart'
import type { CartItem } from '../types'

interface SharedCartProps {
  isOpen: boolean
  onClose: () => void
}

export default function SharedCart({ isOpen, onClose }: SharedCartProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const {
    session,
    currentDiner,
    cartItems,
    diners,
    isSubmitting,
    lastOrderId,
  } = useSharedCartData()

  const {
    updateQuantity,
    removeItem,
    canModifyItem,
    getDinerColor,
    submitOrder,
  } = useCartActions()

  const addToCart = useTableStore((state) => state.addToCart)

  const isMounted = useIsMounted()
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCloseRef = useRef(onClose)

  // Keep onClose ref updated
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Cleanup timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current)
        autoCloseTimerRef.current = null
      }
    }
  }, [])

  // Use reusable escape key hook for consistency
  useEscapeKey({
    enabled: isOpen,
    onEscape: onClose,
    disabled: isSubmitting,
  })

  // React 19: useOptimistic for instant UI feedback
  const {
    optimisticItems,
    isPending: isOptimisticPending,
    updateQuantityOptimistic,
    removeItemOptimistic,
  } = useOptimisticCart({
    cartItems,
    currentDinerId: currentDiner?.id || null,
    currentDinerName: currentDiner?.name || '',
    onAddToCart: addToCart,
    onUpdateQuantity: updateQuantity,
    onRemoveItem: removeItem,
  })

  const { isLoading, isSuccess, isError, error, execute, reset } = useAsync<{
    success: boolean
    error?: string
  }>()

  // Use optimistic items for grouping (instant UI updates)
  const itemsByDiner = useMemo(() => {
    return optimisticItems.reduce((acc, item) => {
      if (!acc[item.diner_id]) {
        acc[item.diner_id] = []
      }
      acc[item.diner_id].push(item)
      return acc
    }, {} as Record<string, CartItem[]>)
  }, [optimisticItems])

  // Calculate totals from optimistic items for instant feedback
  const optimisticCartTotal = useMemo(
    () => optimisticItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [optimisticItems]
  )

  const optimisticMyTotal = useMemo(
    () =>
      optimisticItems
        .filter((item) => item.diner_id === currentDiner?.id)
        .reduce((sum, item) => sum + item.price * item.quantity, 0),
    [optimisticItems, currentDiner?.id]
  )

  // Use optimistic handlers for instant feedback
  const handleQuantityChange = useCallback(
    (item: CartItem, delta: number) => {
      updateQuantityOptimistic(item.id, delta)
    },
    [updateQuantityOptimistic]
  )

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      removeItemOptimistic(itemId)
    },
    [removeItemOptimistic]
  )

  const handleSubmitOrder = useCallback(() => {
    // Prevent double submissions
    if (isLoading || isSubmitting) return

    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current)
    }

    execute(() => submitOrder(), {
      onSuccess: (result) => {
        if (result.success) {
          autoCloseTimerRef.current = setTimeout(() => {
            if (!isMounted()) return
            onClose()
            reset()
          }, 2000)
        }
      },
    })
  }, [execute, submitOrder, onClose, reset, isMounted, isLoading, isSubmitting])

  if (!isOpen) return null

  if (isSuccess) {
    return <OrderSuccess orderId={lastOrderId} />
  }

  if (!session || !currentDiner) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-bg">
        <p className="text-dark-muted">{t('cart.noActiveSession')}</p>
        <button
          onClick={onClose}
          className="mt-4 bg-primary hover:bg-primary/90 text-white font-semibold py-2 px-4 rounded-xl transition-colors"
        >
          {t('cart.close')}
        </button>
      </div>
    )
  }

  const effectiveLoading = isLoading || isSubmitting

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-dark-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Header */}
      <header className="bg-dark-bg border-b border-dark-border px-4 sm:px-6 py-4 safe-area-top">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 id={titleId} className="text-xl sm:text-2xl font-bold text-white">
              {t('cart.title')}
            </h1>
            <p className="text-dark-muted text-sm">
              {t('cart.table')} {session.table_number} · {diners.length}{' '}
              {diners.length === 1 ? t('cart.diner_one') : t('cart.diner_other')}
              {isOptimisticPending && (
                <span
                  className="ml-2 text-primary animate-pulse"
                  role="status"
                  aria-live="polite"
                >
                  {t('cart.updating')}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={effectiveLoading}
            className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center hover:bg-dark-elevated transition-colors disabled:opacity-50"
            aria-label={t('cart.closeCart')}
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Diners avatars */}
      <div className="bg-dark-card border-b border-dark-border px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto">
          {diners.map((diner) => (
            <div
              key={diner.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                diner.id === currentDiner.id
                  ? 'bg-primary/20 border border-primary'
                  : 'bg-dark-elevated'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: diner.avatar_color }}
                aria-hidden="true"
              />
              <span className="text-white text-sm">
                {diner.name}
                {diner.id === currentDiner.id && ` (${t('cart.you')})`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div
          className="max-w-3xl mx-auto space-y-6"
          role="region"
          aria-label={t('cart.cartContents')}
          aria-live="polite"
          aria-atomic="false"
        >
          {optimisticItems.length === 0 ? (
            <CartEmpty onViewMenu={onClose} />
          ) : (
            Object.entries(itemsByDiner).map(([dinerId, items]) => {
              const diner = diners.find((d) => d.id === dinerId)
              const isMySection = dinerId === currentDiner.id
              const sectionTotal = items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
              )

              return (
                <div key={dinerId} className="space-y-3">
                  {/* Section header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getDinerColor(dinerId) }}
                        aria-hidden="true"
                      />
                      <span className="text-white font-medium text-sm">
                        {isMySection ? t('cart.myOrders') : diner?.name || t('cart.diner')}
                      </span>
                    </div>
                    <span className="text-dark-muted text-sm">
                      ${sectionTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <CartItemCard
                        key={item.id}
                        item={item}
                        canModify={canModifyItem(item)}
                        isDisabled={effectiveLoading}
                        onQuantityChange={(delta) =>
                          handleQuantityChange(item, delta)
                        }
                        onRemove={() => handleRemoveItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Footer with totals */}
      {optimisticItems.length > 0 && (
        <div className="bg-dark-card border-t border-dark-border px-4 sm:px-6 py-4 safe-area-bottom">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Totals breakdown - use optimistic values for instant feedback */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-muted">{t('cart.myTotal')}</span>
                <span className="text-white font-medium">
                  ${optimisticMyTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{t('cart.tableTotal')}</span>
                <span className="text-primary text-xl font-bold">
                  ${optimisticCartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Error message - role="alert" for screen reader announcement */}
            {isError && error && (
              <div role="alert" aria-live="assertive">
                <ErrorAlert
                  title={t('cart.submitError')}
                  message={error}
                  onClose={reset}
                />
              </div>
            )}

            {/* Order button */}
            <button
              onClick={handleSubmitOrder}
              disabled={effectiveLoading || optimisticItems.length === 0}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-dark-elevated disabled:text-dark-muted text-white font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {effectiveLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>{t('cart.submitting')}</span>
                </>
              ) : isError ? (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  <span>{t('cart.retrySubmit')}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{t('cart.submitOrder')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
