import { useTranslation } from 'react-i18next'
import type { Diner, SplitMethod, PaymentShare, OrderRecord, CartItem } from '../../types'

interface DinersListProps {
  diners: Diner[]
  shares: PaymentShare[]
  splitMethod: SplitMethod
  getDinerColor: (dinerId: string) => string
}

export function DinersList({ diners, shares, splitMethod, getDinerColor }: DinersListProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      {diners.map((diner) => {
        const share = shares.find((s) => s.diner_id === diner.id)
        return (
          <div key={diner.id} className="bg-dark-card rounded-xl p-4 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: getDinerColor(diner.id) }}
            >
              {diner.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{diner.name}</p>
              <p className="text-dark-muted text-xs">
                {splitMethod === 'equal' ? t('closeTable.equalSplit') : t('closeTable.byConsumption')}
              </p>
            </div>
            <p className="text-white font-bold">${share?.amount.toFixed(2) || '0.00'}</p>
          </div>
        )
      })}
    </div>
  )
}

interface ConsumptionDetailProps {
  diners: Diner[]
  orders: OrderRecord[]
  getDinerColor: (dinerId: string) => string
}

export function ConsumptionDetail({ diners, orders, getDinerColor }: ConsumptionDetailProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-dark-muted text-sm font-medium">{t('closeTable.detailByDiner')}</h3>
      {diners.map((diner) => {
        const dinerItems = orders.flatMap((order) =>
          order.items.filter((item) => item.diner_id === diner.id)
        )
        if (dinerItems.length === 0) return null
        return (
          <DinerConsumptionCard
            key={diner.id}
            dinerName={diner.name}
            items={dinerItems}
            dinerColor={getDinerColor(diner.id)}
          />
        )
      })}
    </div>
  )
}

interface DinerConsumptionCardProps {
  dinerName: string
  items: CartItem[]
  dinerColor: string
}

function DinerConsumptionCard({ dinerName, items, dinerColor }: DinerConsumptionCardProps) {
  return (
    <div className="bg-dark-elevated rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dinerColor }} />
        <span className="text-white text-sm font-medium">{dinerName}</span>
      </div>
      {items.map((item, idx) => (
        <div key={`${item.id}-${idx}`} className="flex justify-between text-xs pl-5">
          <span className="text-dark-muted">
            {item.quantity}x {item.name}
          </span>
          <span className="text-white">${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
