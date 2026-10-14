import { useEffect, useState } from 'react';
import { Bell, X, Truck, MapPin, Phone } from 'lucide-react';
import type { DeliveryOrder } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface OrderToastProps {
  order: DeliveryOrder | null;
  onDismiss: () => void;
  onNavigate?: () => void;
}

export function OrderToast({ order, onDismiss, onNavigate }: OrderToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (order) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [order, onDismiss]);

  if (!order) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[60] w-full max-w-sm transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-brand-400 overflow-hidden">
        {/* Header with pulse animation */}
        <div className="bg-brand-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <div className="relative">
              <Bell size={20} className="animate-bounce" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-300 rounded-full animate-ping" />
            </div>
            <span className="font-bold text-sm">Novo Pedido Recebido!</span>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Order info */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <span className="text-brand-600 font-bold text-sm font-display">#{order.numero_pedido}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink-800 truncate">{order.cliente_nome}</p>
              <p className="text-xs text-ink-400 flex items-center gap-1">
                <Phone size={11} /> {order.cliente_telefone}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-brand-600 font-display">{formatCurrency(Number(order.valor_total))}</p>
              <p className="text-xs text-ink-400">{order.items?.length ?? 0} item(s)</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{order.cliente_endereco}{order.bairro ? ` — ${order.bairro}` : ''}</span>
          </div>

          {onNavigate && (
            <button
              onClick={() => { onNavigate(); setVisible(false); setTimeout(onDismiss, 300); }}
              className="btn-primary w-full justify-center text-sm py-2.5"
            >
              <Truck size={16} />
              Ver na Gestão de Entregas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
