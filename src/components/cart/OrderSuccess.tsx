interface OrderSuccessProps {
  orderId: string | null
}

export default function OrderSuccess({ orderId }: OrderSuccessProps) {
  const displayId = orderId?.slice(-6).toUpperCase() ?? '------'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-bg px-4">
      <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-green-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Pedido enviado</h2>
      <p className="text-dark-muted text-center">
        Tu pedido #{displayId} fue enviado a cocina
      </p>
    </div>
  )
}
