import { useState, useEffect, useCallback, useRef } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useTranslation } from 'react-i18next'

// Store
import { useTableStore } from './stores/tableStore'

// Pages
import Home from './pages/Home'
import PaymentResult from './pages/PaymentResult'

// Components
import JoinTable from './components/JoinTable'
import QRSimulator from './components/QRSimulator'
import NetworkStatus from './components/NetworkStatus'
import ErrorBoundary from './components/ErrorBoundary'

function AppContent() {
  const { t } = useTranslation()
  const session = useTableStore((state) => state.session)

  // State to control whether to show QR simulator or JoinTable
  const [showQRSimulator, setShowQRSimulator] = useState(true)
  const [scannedTable, setScannedTable] = useState<string | null>(null)

  // Check if we're on the payment result page
  const [isPaymentResultPage, setIsPaymentResultPage] = useState(() => {
    return window.location.pathname.includes('/payment/success') ||
           window.location.pathname.includes('/payment/failure') ||
           window.location.pathname.includes('/payment/pending')
  })

  const [needRefresh, setNeedRefresh] = useState(false)
  // Use ref instead of state to avoid setState inside effect
  const updateSWRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let isActive = true // Track if effect is still active

    const sw = registerSW({
      onNeedRefresh() {
        if (isActive) setNeedRefresh(true)
      },
      onOfflineReady() {
        // PWA is ready to work offline
      },
      onRegistered(registration) {
        // Check for updates every hour - only if still mounted
        if (registration && isActive) {
          intervalId = setInterval(() => {
            if (isActive) registration.update()
          }, 60 * 60 * 1000)
        }
      }
    })

    // Save reference without triggering re-render
    updateSWRef.current = sw

    return () => {
      isActive = false // Prevent callbacks from running after unmount
      if (intervalId) {
        clearInterval(intervalId)
      }
      // Note: sw is the function to trigger update, should NOT be called in cleanup
    }
  }, [])

  const handleUpdate = useCallback(async () => {
    if (updateSWRef.current) {
      await updateSWRef.current()
      window.location.reload()
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setNeedRefresh(false)
  }, [])

  // Handle QR scan (simulated)
  const handleScanQR = useCallback((tableNumber: string) => {
    setScannedTable(tableNumber)
    setShowQRSimulator(false)
  }, [])

  // Handle payment result page exit
  const handlePaymentResultContinue = useCallback(() => {
    setIsPaymentResultPage(false)
    // Reset URL to root
    window.history.replaceState({}, '', '/')
  }, [])

  return (
    <div className="min-h-screen bg-dark-bg overflow-x-hidden w-full max-w-full">
      {/* Network status indicator */}
      <NetworkStatus />

      {/* Update notification */}
      {needRefresh && (
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-dark-card border border-dark-border text-white p-4 rounded-xl shadow-lg safe-area-bottom">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('pwa.newVersionAvailable')}</p>
              <p className="text-dark-muted text-sm mt-0.5">{t('pwa.updateForImprovements')}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 bg-dark-elevated text-white py-2.5 rounded-lg font-medium hover:bg-dark-border transition-colors"
            >
              {t('pwa.later')}
            </button>
            <button
              onClick={handleUpdate}
              className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors"
            >
              {t('pwa.update')}
            </button>
          </div>
        </div>
      )}

      {/* Application flow:
          0. If payment result page -> PaymentResult
          1. If active session -> Home (menu)
          2. If simulated QR scanned -> JoinTable with that table (name only)
          3. If nothing -> QRSimulator (initial screen)
      */}
      {isPaymentResultPage ? (
        <PaymentResult onContinue={handlePaymentResultContinue} />
      ) : session ? (
        <Home />
      ) : scannedTable ? (
        // After QR scanned - go to name entry (table already set)
        <JoinTable defaultTableNumber={scannedTable} />
      ) : showQRSimulator ? (
        // Initial screen: QR simulator
        <QRSimulator onScanQR={handleScanQR} />
      ) : (
        // Fallback to JoinTable
        <JoinTable defaultTableNumber="1" />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}
