import { useEffect, useState, useRef } from 'react';
import {
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Search,
  Printer,
  FileDown,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User,
  StickyNote,
  Bike,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { printOrder, exportPDF, exportCSV } from '@/lib/deliveryExport';
import type { DeliveryOrder, DeliveryStatus, PaymentStatus } from '@/lib/types';

const statusLabels: Record<DeliveryStatus, string> = {
  aguardando: 'Aguardando',
  recebido: 'Recebido',
  saiu_entrega: 'Saiu para Entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const statusColors: Record<DeliveryStatus, string> = {
  aguardando: 'bg-amber-100 text-amber-700',
  recebido: 'bg-blue-100 text-blue-700',
  saiu_entrega: 'bg-sky-100 text-sky-700',
  entregue: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-red-100 text-red-700',
};

const statusOptions: DeliveryStatus[] = ['aguardando', 'recebido', 'saiu_entrega', 'entregue', 'cancelado'];

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
};

const paymentIcons: Record<string, typeof Banknote> = {
  dinheiro: Banknote,
  pix: Smartphone,
  cartao: CreditCard,
};

export function DeliveryDashboardPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    motoboy: '',
    date: '',
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('delivery_orders')
      .select('*, items:delivery_order_items(*)')
      .order('data_pedido', { ascending: false });
    setOrders((data ?? []) as DeliveryOrder[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const reloadRef = useRef(load);
  reloadRef.current = load;

  useEffect(() => {
    const channel = supabase
      .channel('delivery-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, () => reloadRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_order_items' }, () => reloadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(orderId: string, status: DeliveryStatus) {
    await supabase.from('delivery_orders').update({ status_entrega: status }).eq('id', orderId);
    load();
  }

  async function updatePaymentStatus(orderId: string, status: PaymentStatus) {
    await supabase.from('delivery_orders').update({ status_pagamento: status, pago: status === 'pago' }).eq('id', orderId);
    load();
  }

  async function updateMotoboy(orderId: string, motoboy: string) {
    await supabase.from('delivery_orders').update({ motoboy: motoboy || null }).eq('id', orderId);
    load();
  }

  const motoboys = Array.from(new Set(orders.map((o) => o.motoboy).filter(Boolean))) as string[];

  const filtered = orders.filter((o) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!o.cliente_nome.toLowerCase().includes(s) &&
        !o.cliente_telefone.includes(s) &&
        !String(o.numero_pedido).includes(s)) return false;
    }
    if (filters.status !== 'all' && o.status_entrega !== filters.status) return false;
    if (filters.motoboy && o.motoboy !== filters.motoboy) return false;
    if (filters.date) {
      const orderDate = new Date(o.data_pedido).toISOString().slice(0, 10);
      if (orderDate !== filters.date) return false;
    }
    return true;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => new Date(o.data_pedido) >= today);
  const todayCount = todayOrders.length;
  const deliveredCount = todayOrders.filter((o) => o.status_entrega === 'entregue').length;
  const inDeliveryCount = todayOrders.filter((o) => o.status_entrega === 'saiu_entrega').length;
  const canceledCount = todayOrders.filter((o) => o.status_entrega === 'cancelado').length;
  const todayRevenue = todayOrders
    .filter((o) => o.status_entrega !== 'cancelado')
    .reduce((s, o) => s + Number(o.valor_total), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-800 font-display flex items-center gap-2">
          <Truck size={24} className="text-brand-500" />
          Gestão de Entregas
        </h1>
        <p className="text-ink-500 text-sm mt-0.5">Acompanhe e gerencie todos os pedidos de delivery</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-brand-500" />
            <span className="text-xs text-ink-400 font-medium">Pedidos Hoje</span>
          </div>
          <p className="text-2xl font-bold text-ink-800 font-display">{todayCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-xs text-ink-400 font-medium">Entregues</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 font-display">{deliveredCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bike size={16} className="text-sky-500" />
            <span className="text-xs text-ink-400 font-medium">Em Entrega</span>
          </div>
          <p className="text-2xl font-bold text-sky-600 font-display">{inDeliveryCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={16} className="text-red-500" />
            <span className="text-xs text-ink-400 font-medium">Cancelados</span>
          </div>
          <p className="text-2xl font-bold text-red-500 font-display">{canceledCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-brand-600 font-bold">R$</span>
            <span className="text-xs text-ink-400 font-medium">Faturamento</span>
          </div>
          <p className="text-2xl font-bold text-ink-800 font-display">{formatCurrency(todayRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Buscar por nº, nome, telefone..."
              className="input pl-11"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="all">Todos os Status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
          <select
            value={filters.motoboy}
            onChange={(e) => setFilters({ ...filters, motoboy: e.target.value })}
            className="input"
          >
            <option value="">Todos Motoboys</option>
            {motoboys.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="input flex-1"
            />
            <button
              onClick={() => exportCSV(filtered)}
              disabled={filtered.length === 0}
              className="btn-ghost shrink-0 text-xs"
              title="Exportar CSV"
            >
              <FileSpreadsheet size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Truck size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500 font-medium">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isExpanded = expandedId === order.id;
            const PaymentIcon = order.forma_pagamento ? paymentIcons[order.forma_pagamento] : null;
            return (
              <div key={order.id} className="card overflow-hidden">
                {/* Order header */}
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-ink-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <span className="text-brand-600 font-bold text-sm font-display">#{order.numero_pedido}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-ink-800">{order.cliente_nome}</p>
                      <span className={`badge text-[10px] ${statusColors[order.status_entrega]}`}>
                        {statusLabels[order.status_entrega]}
                      </span>
                      {order.pago && (
                        <span className="badge text-[10px] bg-emerald-100 text-emerald-700">
                          Pago
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 flex items-center gap-2 mt-0.5">
                      <Clock size={11} />
                      {formatDateTime(order.data_pedido)}
                      {order.bairro && <span>• {order.bairro}</span>}
                      {PaymentIcon && <span className="flex items-center gap-0.5"><PaymentIcon size={11} /> {paymentLabels[order.forma_pagamento!]}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ink-800 font-display">{formatCurrency(Number(order.valor_total))}</p>
                    <p className="text-xs text-ink-400">{order.items?.length ?? 0} item(s)</p>
                  </div>
                  <button className="p-1 text-ink-400 shrink-0">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-ink-100 px-5 py-4 space-y-4 animate-slide-up">
                    {/* Customer info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <User size={15} className="text-ink-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-ink-400">Cliente</p>
                            <p className="text-ink-700 font-medium">{order.cliente_nome}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <Phone size={15} className="text-ink-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-ink-400">Telefone</p>
                            <p className="text-ink-700 font-medium">{order.cliente_telefone}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin size={15} className="text-ink-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-ink-400">Endereço</p>
                            <p className="text-ink-700 font-medium">{order.cliente_endereco}</p>
                            {order.complemento && <p className="text-ink-500 text-xs">{order.complemento}</p>}
                            {order.bairro && <p className="text-ink-500 text-xs">{order.bairro}</p>}
                          </div>
                        </div>
                        {order.observacao && (
                          <div className="flex items-start gap-2 text-sm">
                            <StickyNote size={15} className="text-ink-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs text-ink-400">Observação</p>
                              <p className="text-ink-700 font-medium">{order.observacao}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Payment info */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <CreditCard size={14} /> Pagamento
                          </label>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-ink-700 font-medium">
                              {order.forma_pagamento ? paymentLabels[order.forma_pagamento] ?? order.forma_pagamento : 'Não informado'}
                            </span>
                            <span className={`badge text-[10px] ${order.status_pagamento === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {order.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                            </span>
                          </div>
                          {order.status_pagamento !== 'pago' && (
                            <button
                              onClick={() => updatePaymentStatus(order.id, 'pago')}
                              className="btn-primary text-xs py-1.5 px-3"
                            >
                              Marcar como Pago
                            </button>
                          )}
                        </div>

                        {/* Motoboy assignment */}
                        <div>
                          <label className="label flex items-center gap-1.5">
                            <Bike size={14} /> Motoboy Responsável
                          </label>
                          <input
                            type="text"
                            defaultValue={order.motoboy ?? ''}
                            onBlur={(e) => updateMotoboy(order.id, e.target.value)}
                            placeholder="Atribuir motoboy..."
                            className="input"
                          />
                        </div>

                        {/* Status update */}
                        <div>
                          <label className="label">Status da Entrega</label>
                          <div className="flex flex-wrap gap-2">
                            {statusOptions.map((s) => (
                              <button
                                key={s}
                                onClick={() => updateStatus(order.id, s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  order.status_entrega === s
                                    ? statusColors[s] + ' ring-2 ring-offset-1'
                                    : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                                }`}
                              >
                                {statusLabels[s]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Produtos</p>
                      <div className="bg-ink-50 rounded-xl divide-y divide-ink-100">
                        {(order.items ?? []).map((item) => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                            <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold shrink-0">
                              {item.quantidade}x
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-ink-700">{item.produto_nome}</p>
                              {item.descricao && <p className="text-xs text-ink-400 truncate">{item.descricao}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-ink-700">{formatCurrency(Number(item.subtotal))}</p>
                              <p className="text-xs text-ink-400">{formatCurrency(Number(item.valor_unitario))} un.</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total + Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm text-ink-500 gap-8">
                          <span>Taxa de Entrega</span>
                          <span>{formatCurrency(Number(order.taxa_entrega))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-ink-800 gap-8">
                          <span>Total</span>
                          <span className="font-display text-lg">{formatCurrency(Number(order.valor_total))}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); printOrder(order); }}
                          className="btn-ghost text-xs"
                        >
                          <Printer size={14} /> Imprimir
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); exportPDF(order); }}
                          className="btn-ghost text-xs"
                        >
                          <FileDown size={14} /> PDF
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); exportCSV([order]); }}
                          className="btn-ghost text-xs"
                        >
                          <FileSpreadsheet size={14} /> CSV
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
