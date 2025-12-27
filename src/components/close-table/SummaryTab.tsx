import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { DinersList, ConsumptionDetail } from './DinersList'
import type { Diner, PaymentShare, OrderRecord, SplitMethod } from '../../types'

interface SummaryTabProps {
  diners: Diner[]
  shares: PaymentShare[]
  orders: OrderRecord[]
  splitMethod: SplitMethod
  onSplitMethodToggle: () => void
  getDinerColor: (dinerId: string) => string
}

export const SummaryTab = memo(function SummaryTab({
  diners,
  shares,
  orders,
  splitMethod,
  onSplitMethodToggle,
  getDinerColor,
}: SummaryTabProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Split method */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">{t('closeTable.diners', { count: diners.length })}</h2>
        <button onClick={onSplitMethodToggle} className="text-primary text-sm font-medium">
          {splitMethod === 'equal' ? t('closeTable.byConsumption') : t('closeTable.equalSplit')}
        </button>
      </div>

      {/* Diners list */}
      <DinersList
        diners={diners}
        shares={shares}
        splitMethod={splitMethod}
        getDinerColor={getDinerColor}
      />

      {/* Consumption detail per diner (by consumption mode) */}
      {splitMethod === 'by_consumption' && orders.length > 0 && (
        <ConsumptionDetail
          diners={diners}
          orders={orders}
          getDinerColor={getDinerColor}
        />
      )}
    </div>
  )
})
