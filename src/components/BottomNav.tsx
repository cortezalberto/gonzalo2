import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOrderHistoryData, useSession } from '../stores/tableStore'
import OrderHistory from './OrderHistory'

interface BottomNavProps {
  onCloseTable?: () => void
  onAIChat?: () => void
}

export default function BottomNav({ onCloseTable, onAIChat }: BottomNavProps) {
  const { t } = useTranslation()
  const session = useSession()
  const { orders, totalConsumed, currentRound } = useOrderHistoryData()
  const [showHistory, setShowHistory] = useState(false)

  const hasOrders = orders.length > 0

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-dark-bg pb-4 sm:pb-6 pt-3 sm:pt-4 safe-area-bottom border-t border-dark-border md:border-t-0"
        aria-label={t('bottomNav.mainNav')}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 flex items-center justify-between gap-4">
          {/* Order history button */}
          <button
            onClick={() => setShowHistory(true)}
            disabled={!hasOrders}
            className="flex-1 h-12 sm:h-14 rounded-xl border border-dark-border flex items-center justify-center gap-2 hover:border-white hover:bg-white/5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 disabled:hover:border-dark-border disabled:hover:bg-transparent"
            aria-label={t('bottomNav.orderHistory')}
          >
            <svg
              className="w-5 h-5 text-dark-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
            <div className="text-left">
              <span className="text-dark-muted text-sm font-medium block leading-tight">
                {hasOrders ? `${currentRound} ${t('bottomNav.round', { count: currentRound })}` : t('bottomNav.noOrders')}
              </span>
              {hasOrders && (
                <span className="text-dark-muted/70 text-xs leading-tight">
                  ${totalConsumed.toFixed(2)}
                </span>
              )}
            </div>
          </button>

          {/* AI Chat button - centered star */}
          <button
            onClick={onAIChat}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg shadow-lg -mt-8"
            aria-label={t('bottomNav.aiAssistant')}
          >
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 text-dark-bg"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>

          {/* Request bill button */}
          <button
            onClick={onCloseTable}
            disabled={!session}
            className="flex-1 h-12 sm:h-14 rounded-xl border border-dark-border flex items-center justify-center gap-2 hover:border-white hover:bg-white/5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50 disabled:hover:border-dark-border disabled:hover:bg-transparent"
            aria-label={t('bottomNav.askForBill')}
          >
            <svg
              className="w-5 h-5 text-dark-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
              />
            </svg>
            <span className="text-dark-muted text-sm font-semibold">{t('bottomNav.askForBill')}</span>
          </button>
        </div>
      </nav>

      {/* History modal */}
      <OrderHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </>
  )
}
