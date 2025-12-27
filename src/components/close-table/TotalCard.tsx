import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface TotalCardProps {
  totalConsumed: number
  ordersCount: number
  currentRound: number
}

export const TotalCard = memo(function TotalCard({
  totalConsumed,
  ordersCount,
  currentRound,
}: TotalCardProps) {
  const { t } = useTranslation()
  const orderWord = ordersCount === 1 ? t('closeTable.order_one') : t('closeTable.order_other')
  const roundWord = currentRound === 1 ? t('bottomNav.round') : t('bottomNav.round_plural')

  return (
    <div className="bg-dark-card rounded-xl p-6 text-center">
      <p className="text-dark-muted text-sm mb-1">{t('closeTable.totalConsumed')}</p>
      <p className="text-primary text-4xl font-bold">${totalConsumed.toFixed(2)}</p>
      <p className="text-dark-muted text-sm mt-2">
        {ordersCount} {orderWord} · {currentRound} {roundWord}
      </p>
    </div>
  )
})
