import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../ui/LoadingSpinner'
import {
  createPaymentPreference,
  redirectToCheckout,
  isTestMode,
} from '../../services/mercadoPago'
import { apiLogger } from '../../utils/logger'

export type CloseStatus =
  | 'idle'
  | 'requesting'
  | 'waiting'
  | 'waiter_coming'
  | 'bill_ready'
  | 'processing_payment'
  | 'paid'

export type PaymentMethod = 'card' | 'cash' | 'mercadopago'

interface CloseStatusViewProps {
  status: CloseStatus
  waiterName: string
  estimatedTime: number
  tableNumber: string
  totalConsumed: number
  sessionId?: string
  onConfirmPayment: (method: PaymentMethod) => void
}

export function CloseStatusView({
  status,
  waiterName,
  estimatedTime,
  tableNumber,
  totalConsumed,
  sessionId,
  onConfirmPayment,
}: CloseStatusViewProps) {
  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 safe-area-inset overflow-x-hidden w-full max-w-full">
      <div className="w-full max-w-sm">
        {status === 'requesting' && <RequestingState />}
        {status === 'waiting' && <WaitingState />}
        {status === 'waiter_coming' && (
          <WaiterComingState
            waiterName={waiterName}
            estimatedTime={estimatedTime}
            tableNumber={tableNumber}
            totalConsumed={totalConsumed}
          />
        )}
        {status === 'bill_ready' && (
          <BillReadyState
            waiterName={waiterName}
            tableNumber={tableNumber}
            totalConsumed={totalConsumed}
            sessionId={sessionId}
            onConfirmPayment={onConfirmPayment}
          />
        )}
        {status === 'processing_payment' && <ProcessingPaymentState />}
      </div>
    </div>
  )
}

function RequestingState() {
  const { t } = useTranslation()
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{t('closeTable.requestingBill')}</h1>
      <p className="text-dark-muted">{t('closeTable.sendingRequest')}</p>
    </div>
  )
}

function WaitingState() {
  const { t } = useTranslation()
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-yellow-400 animate-pulse"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{t('closeTable.billRequested')}</h1>
      <p className="text-dark-muted mb-6">{t('closeTable.waitingWaiterAccept')}</p>
      <div className="bg-dark-card rounded-xl p-4">
        <div className="flex items-center justify-center gap-2">
          <div
            className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}

function ProcessingPaymentState() {
  const { t } = useTranslation()
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{t('closeTable.processingPayment')}</h1>
      <p className="text-dark-muted">{t('closeTable.redirectingToPayment')}</p>
    </div>
  )
}

interface WaiterComingStateProps {
  waiterName: string
  estimatedTime: number
  tableNumber: string
  totalConsumed: number
}

function WaiterComingState({
  waiterName,
  estimatedTime,
  tableNumber,
  totalConsumed,
}: WaiterComingStateProps) {
  const { t } = useTranslation()
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-blue-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{t('closeTable.waiterOnWay')}</h1>
      <p className="text-dark-muted mb-6">
        <span className="text-blue-400 font-medium">{waiterName}</span> {t('closeTable.approachingTable')}
      </p>
      <div className="bg-dark-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-dark-muted text-sm">{t('closeTable.estimatedTime', { time: '' }).replace(': ', '')}</span>
          <span className="text-white font-medium">~{estimatedTime} min</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dark-muted text-sm">{t('closeTable.table')}</span>
          <span className="text-white font-medium">{tableNumber}</span>
        </div>
        <div className="flex items-center justify-between border-t border-dark-border pt-3">
          <span className="text-dark-muted text-sm">{t('closeTable.total')}</span>
          <span className="text-primary font-bold text-xl">${totalConsumed.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

interface BillReadyStateProps {
  waiterName: string
  tableNumber: string
  totalConsumed: number
  sessionId?: string
  onConfirmPayment: (method: PaymentMethod) => void
}

function BillReadyState({
  waiterName,
  tableNumber,
  totalConsumed,
  sessionId,
  onConfirmPayment,
}: BillReadyStateProps) {
  const { t } = useTranslation()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('mercadopago')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMercadoPagoPayment = useCallback(async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Calculate total with tip
      const totalWithTip = totalConsumed * 1.1

      // Create payment preference
      const preference = await createPaymentPreference({
        items: [
          {
            id: sessionId || 'order-' + Date.now(),
            title: `Mesa ${tableNumber} - Consumo`,
            description: `Pago de consumo en mesa ${tableNumber}`,
            quantity: 1,
            unit_price: totalWithTip,
            currency_id: 'ARS',
          },
        ],
        external_reference: sessionId || `table-${tableNumber}-${Date.now()}`,
        back_urls: {
          success: `${window.location.origin}/payment/success`,
          failure: `${window.location.origin}/payment/failure`,
          pending: `${window.location.origin}/payment/pending`,
        },
        auto_return: 'approved',
        statement_descriptor: 'BARIJHO',
        metadata: {
          table_number: tableNumber,
          session_id: sessionId,
          total_consumed: totalConsumed,
          tip_percentage: 10,
        },
      })

      apiLogger.info('Redirecting to Mercado Pago checkout', {
        preferenceId: preference.id,
        isTestMode: isTestMode(),
      })

      // Redirect to Mercado Pago checkout
      redirectToCheckout(preference)
    } catch (err) {
      apiLogger.error('Failed to create payment preference', err)
      setError(t('closeTable.paymentError'))
      setIsProcessing(false)
    }
  }, [totalConsumed, tableNumber, sessionId, t])

  const handleConfirmPayment = useCallback(() => {
    if (selectedMethod === 'mercadopago') {
      handleMercadoPagoPayment()
    } else {
      // For cash, just confirm locally
      onConfirmPayment(selectedMethod)
    }
  }, [selectedMethod, handleMercadoPagoPayment, onConfirmPayment])

  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-green-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{t('closeTable.billDelivered')}</h1>
      <p className="text-dark-muted mb-6">
        <span className="text-green-400 font-medium">{waiterName}</span> {t('closeTable.deliveredBill')}
      </p>

      {/* Bill summary */}
      <div className="bg-dark-card rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-dark-muted text-sm">{t('closeTable.subtotal')}</span>
          <span className="text-white">${totalConsumed.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dark-muted text-sm">{t('closeTable.suggestedTip')}</span>
          <span className="text-white">${(totalConsumed * 0.1).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-dark-border pt-3">
          <span className="text-white font-medium">{t('closeTable.suggestedTotal')}</span>
          <span className="text-primary font-bold text-xl">
            ${(totalConsumed * 1.1).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-dark-card rounded-xl p-4 mb-6">
        <p className="text-dark-muted text-sm mb-3">{t('closeTable.paymentMethod')}</p>
        <PaymentMethodSelector
          selectedMethod={selectedMethod}
          onMethodChange={setSelectedMethod}
          disabled={isProcessing}
        />
      </div>

      {/* Test mode indicator */}
      {isTestMode() && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-3 mb-4">
          <p className="text-yellow-400 text-xs">
            {t('closeTable.testMode')}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleConfirmPayment}
        disabled={isProcessing}
        className={`w-full font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center gap-3 ${
          selectedMethod === 'mercadopago'
            ? 'bg-[#00BCFF] hover:bg-[#00A8E8] disabled:bg-[#00BCFF]/50 text-white'
            : 'bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white'
        }`}
      >
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" />
            <span>{t('closeTable.processingPayment')}</span>
          </>
        ) : selectedMethod === 'mercadopago' ? (
          <>
            <MercadoPagoIcon className="w-7 h-7" />
            <span>{t('closeTable.payWithMercadoPago')}</span>
          </>
        ) : (
          <span>{t('closeTable.confirmPayment')}</span>
        )}
      </button>
    </div>
  )
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  disabled?: boolean
}

function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  disabled,
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation()

  const methods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    {
      id: 'mercadopago',
      label: 'Mercado Pago',
      icon: <MercadoPagoIcon />,
    },
    {
      id: 'card',
      label: t('closeTable.card'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
          />
        </svg>
      ),
    },
    {
      id: 'cash',
      label: t('closeTable.cash'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {methods.map((method) => {
        const isSelected = selectedMethod === method.id
        const isMercadoPago = method.id === 'mercadopago'
        return (
          <button
            key={method.id}
            onClick={() => onMethodChange(method.id)}
            disabled={disabled}
            className={`bg-dark-elevated hover:bg-dark-border rounded-lg p-3 flex flex-col items-center gap-1 transition-colors border-2 ${
              isSelected ? 'border-primary' : 'border-transparent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {/* Mercado Pago icon keeps its own colors */}
            {isMercadoPago ? (
              <MercadoPagoIcon className="w-6 h-6" />
            ) : (
              <span className={isSelected ? 'text-primary' : 'text-dark-muted'}>
                {method.icon}
              </span>
            )}
            <span
              className={`text-xs ${
                isSelected ? 'text-primary font-medium' : 'text-dark-muted'
              }`}
            >
              {method.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Mercado Pago official logo (handshake icon)
function MercadoPagoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mercado Pago handshake logo */}
      <circle cx="24" cy="24" r="24" fill="#00BCFF" />
      <path
        d="M34.5 20.5c-1.2-1.2-3.1-1.2-4.2 0l-3.8 3.8-1.5-1.5c-1.2-1.2-3.1-1.2-4.2 0-1.2 1.2-1.2 3.1 0 4.2l3.6 3.6c.6.6 1.3.9 2.1.9.8 0 1.5-.3 2.1-.9l5.9-5.9c1.2-1.1 1.2-3 0-4.2z"
        fill="white"
      />
      <path
        d="M13.5 20.5c1.2-1.2 3.1-1.2 4.2 0l1.3 1.3-2.1 2.1-1.3-1.3c-.6-.6-.6-1.5 0-2.1z"
        fill="white"
      />
      <path
        d="M24 14c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"
        fill="white"
        fillOpacity="0.3"
      />
    </svg>
  )
}
