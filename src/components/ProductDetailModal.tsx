import { useState, useActionState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTableStore } from '../stores/tableStore'
import { useAutoCloseTimer, useEscapeKey } from '../hooks'
import { ANIMATION, QUANTITY } from '../constants/timing'
import { getSafeImageUrl, FALLBACK_IMAGES } from '../utils/validation'
import { getAllergensByIds } from '../services/mockData'
import type { Product } from '../types'

interface ProductDetailModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
}

// React 19: Form state type for useActionState
interface AddToCartState {
  status: 'idle' | 'adding' | 'success'
  error: string | null
}

// Wrapper component to force remount when product changes
export default function ProductDetailModal({ product, isOpen, onClose }: ProductDetailModalProps) {
  // Use key to remount inner component when product changes, resetting all state
  if (!isOpen || !product) return null

  return (
    <ProductDetailModalInner
      key={product.id}
      product={product}
      onClose={onClose}
    />
  )
}

interface ProductDetailModalInnerProps {
  product: Product
  onClose: () => void
}

function ProductDetailModalInner({ product, onClose }: ProductDetailModalInnerProps) {
  const { t } = useTranslation()
  // State initialized fresh on each mount (due to key={product.id} in parent)
  const [quantity, setQuantity] = useState<number>(QUANTITY.MIN_PRODUCT_QUANTITY)
  const [notes, setNotes] = useState('')
  const addToCart = useTableStore((state) => state.addToCart)

  // Validate image URL - memoized to avoid revalidation on every render
  const safeImageUrl = useMemo(
    () => getSafeImageUrl(product.image, 'product'),
    [product.image]
  )

  // Handle image load error - fallback to default image
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = FALLBACK_IMAGES.product
  }, [])

  // React 19: useActionState for add to cart with automatic pending states
  const [formState, formAction, isPending] = useActionState(
    async (_prevState: AddToCartState, formData: FormData): Promise<AddToCartState> => {
      try {
        const qtyValue = formData.get('quantity')
        const qty = typeof qtyValue === 'string' ? parseInt(qtyValue, 10) || 1 : 1
        const notesValue = formData.get('notes')
        const itemNotes = typeof notesValue === 'string' ? notesValue : ''

        // Add to cart
        addToCart({
          product_id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: qty,
          notes: itemNotes || undefined,
        })

        return { status: 'success', error: null }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'errors.unknownError'
        return { status: 'idle', error: errorMessage }
      }
    },
    { status: 'idle', error: null }
  )

  const showSuccess = formState.status === 'success'

  // Use reusable hooks for auto-close and escape key handling
  useAutoCloseTimer({
    enabled: showSuccess,
    onClose,
    delay: ANIMATION.SUCCESS_FEEDBACK_MS,
  })

  useEscapeKey({
    enabled: true,
    onEscape: onClose,
  })

  const incrementQuantity = () => setQuantity((q) => Math.min(q + 1, QUANTITY.MAX_PRODUCT_QUANTITY))
  const decrementQuantity = () => setQuantity((q) => Math.max(q - 1, QUANTITY.MIN_PRODUCT_QUANTITY))

  // product is guaranteed by wrapper component
  const totalPrice = product.price * quantity
  const isAdding = isPending || formState.status === 'adding'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-card rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up sm:animate-fade-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-dark-bg/80 flex items-center justify-center hover:bg-dark-elevated transition-colors"
          aria-label={t('product.close')}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Product Image */}
        <div className="relative h-48 sm:h-56 bg-dark-elevated flex-shrink-0">
          <img
            src={safeImageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
          {product.badge && (
            <span className="absolute top-4 left-4 bg-badge-gold text-black text-xs px-2 py-1 rounded font-semibold">
              {product.badge}
            </span>
          )}
        </div>

        {/* Content */}
        <form action={formAction} className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Hidden inputs for form data */}
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="notes" value={notes} />

          {/* Header */}
          <div className="mb-4">
            <h2 id="product-title" className="text-xl sm:text-2xl font-bold text-white mb-2">
              {product.name}
            </h2>
            <p className="text-dark-muted text-sm sm:text-base">
              {product.description}
            </p>
          </div>

          {/* Price and Allergens */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-white text-2xl font-bold">
              ${product.price.toFixed(2)}
            </span>
            {product.allergen_ids && product.allergen_ids.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {getAllergensByIds(product.allergen_ids).map((allergen) => (
                  <span
                    key={allergen.id}
                    className="text-xs bg-dark-elevated text-white px-2 py-1 rounded flex items-center gap-1"
                  >
                    {allergen.icon && <span>{allergen.icon}</span>}
                    {allergen.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label htmlFor="notes-input" className="block text-white text-sm font-medium mb-2">
              {t('product.specialNotes')}
            </label>
            <textarea
              id="notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('product.notesPlaceholder')}
              disabled={isAdding}
              className="w-full bg-dark-elevated border border-dark-border rounded-xl p-3 text-white placeholder-dark-muted text-sm resize-none focus:outline-none focus:border-white transition-colors disabled:opacity-50"
              rows={2}
              maxLength={QUANTITY.MAX_NOTES_LENGTH}
            />
          </div>

          {/* Call Waiter, Quantity Selector and Add Button */}
          <div className="flex items-center justify-between gap-3">
            {/* Call Waiter Button */}
            <button
              type="button"
              onClick={() => {
                // TODO: Implement call waiter functionality
              }}
              className="py-2 px-3 rounded-xl bg-dark-elevated border border-dark-border text-white text-xs font-medium hover:border-white transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span>{t('callWaiter.title')}</span>
            </button>

            {/* Quantity controls and Add Button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={decrementQuantity}
                disabled={quantity <= QUANTITY.MIN_PRODUCT_QUANTITY || isAdding}
                className="w-6 h-6 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('product.decreaseQuantity')}
              >
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>
              <span className="text-white font-semibold text-sm w-5 text-center">{quantity}</span>
              <button
                type="button"
                onClick={incrementQuantity}
                disabled={quantity >= QUANTITY.MAX_PRODUCT_QUANTITY || isAdding}
                className="w-6 h-6 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('product.increaseQuantity')}
              >
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Add to Cart Button */}
            <button
              type="submit"
              disabled={isAdding}
              className={`py-2 px-3 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 ${
                showSuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-dark-elevated border border-dark-border text-white hover:border-white'
              } disabled:cursor-not-allowed`}
            >
              {showSuccess ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('product.added')}</span>
                </>
              ) : isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('product.adding')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{t('product.add')} ${totalPrice.toFixed(2)}</span>
                </>
              )}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
