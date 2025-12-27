import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useOrderHistoryData,
  useCloseTableActions,
  useTableStore,
  useSession,
} from '../stores/tableStore'
import { useCloseTableFlow } from '../hooks'
import {
  CloseStatusView,
  PaidView,
  NoSessionView,
  OrdersList,
  CloseTableHeader,
  TotalCard,
  CartWarning,
  TabSelector,
  SummaryTab,
  ErrorBanner,
} from '../components/close-table'
import type { CloseTableTab } from '../components/close-table'
import SectionErrorBoundary from '../components/ui/SectionErrorBoundary'
import type { SplitMethod } from '../types'

interface CloseTableProps {
  onBack: () => void
}

export default function CloseTable({ onBack }: CloseTableProps) {
  const { t } = useTranslation()
  const session = useSession()
  const { orders, totalConsumed, currentRound } = useOrderHistoryData()
  const { closeTable, getPaymentShares, leaveTable } = useCloseTableActions()
  const getDinerColor = useTableStore((state) => state.getDinerColor)

  const [activeTab, setActiveTab] = useState<CloseTableTab>('summary')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('by_consumption')

  const {
    closeStatus,
    waiterName,
    estimatedTime,
    error,
    isProcessing,
    startCloseFlow,
    confirmPayment,
    setError,
  } = useCloseTableFlow(closeTable)

  const handleCloseTable = useCallback(async () => {
    if (!session) return

    if (session.shared_cart.length > 0) {
      setError(t('closeTable.cartErrorPending'))
      return
    }

    await startCloseFlow()
  }, [session, startCloseFlow, setError, t])

  const handleLeaveTable = useCallback(() => {
    leaveTable()
    onBack()
  }, [leaveTable, onBack])

  // No session view
  if (!session) {
    return <NoSessionView onBack={onBack} />
  }

  // Processing states view
  if (isProcessing) {
    return (
      <CloseStatusView
        status={closeStatus}
        waiterName={waiterName}
        estimatedTime={estimatedTime}
        tableNumber={session.table_number}
        totalConsumed={totalConsumed}
        sessionId={session.id}
        onConfirmPayment={confirmPayment}
      />
    )
  }

  // Paid view
  if (closeStatus === 'paid') {
    return (
      <PaidView
        totalConsumed={totalConsumed}
        tableNumber={session.table_number}
        waiterName={waiterName}
        onLeaveTable={handleLeaveTable}
      />
    )
  }

  const diners = session.diners
  const shares = getPaymentShares(splitMethod)
  const hasItemsInCart = session.shared_cart.length > 0

  return (
    <div className="min-h-screen bg-dark-bg safe-area-inset">
      {/* Header */}
      <CloseTableHeader tableNumber={session.table_number} onBack={onBack} />

      {/* Content */}
      <main className="px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Total */}
          <TotalCard
            totalConsumed={totalConsumed}
            ordersCount={orders.length}
            currentRound={currentRound}
          />

          {/* Warning if there are items in cart */}
          {hasItemsInCart && (
            <CartWarning cartItemsCount={session.shared_cart.length} />
          )}

          {/* Tabs */}
          <TabSelector
            activeTab={activeTab}
            ordersCount={orders.length}
            onTabChange={setActiveTab}
          />

          {/* Tab Content */}
          <SectionErrorBoundary sectionName={activeTab === 'summary' ? 'Resumen' : 'Pedidos'}>
            {activeTab === 'summary' ? (
              <SummaryTab
                diners={diners}
                shares={shares}
                orders={orders}
                splitMethod={splitMethod}
                onSplitMethodToggle={() =>
                  setSplitMethod((m) => (m === 'equal' ? 'by_consumption' : 'equal'))
                }
                getDinerColor={getDinerColor}
              />
            ) : (
              <OrdersList orders={orders} getDinerColor={getDinerColor} />
            )}
          </SectionErrorBoundary>

          {/* Error */}
          {error && <ErrorBanner message={error} />}

          {/* Request bill button */}
          <button
            onClick={handleCloseTable}
            disabled={orders.length === 0 || hasItemsInCart}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-dark-elevated disabled:text-dark-muted text-white font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
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
            <span>{t('closeTable.requestBill')}</span>
          </button>

          {orders.length === 0 && (
            <p className="text-dark-muted text-sm text-center">
              {t('closeTable.noOrdersToClose')}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
