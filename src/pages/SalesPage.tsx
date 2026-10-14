import { useEffect, useState, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Printer,
  FileDown,
  FileSpreadsheet,
  Truck,
  User,
  Banknote,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { printOrder, exportPDF, exportCSV } from '@/lib/deliveryExport';
import type { Pizza, Sale, RegisterSaleResult, DeliveryOrder, DeliveryStatus, PaymentMethod, CreateDeliveryOrderResult } from '@/lib/types';

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
const TAXA_ENTREGA = 6.0;

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<'presencial' | 'delivery'>('presencial');

  // Presential sale form
  const [selectedPizza, setSelectedPizza] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<RegisterSaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Delivery sale form
  const [dNome, setDNome] = useState('');
  const [dTelefone, setDTelefone] = useState('');
  const [dEndereco, setDEndereco] = useState('');
  const [dMotoboy, setDMotoboy] = useState('');
  const [dObservacao, setDObservacao] = useState('');
  const [dPagamento, setDPagamento] = useState<PaymentMethod>('dinheiro');
  const [dItems, setDItems] = useState<{ pizza: Pizza; quantidade: number }[]>([]);
  const [dSubmitting, setDSubmitting] = useState(false);
  const [dError, setDError] = useState<string | null>(null);
  const [dResult, setDResult] = useState<CreateDeliveryOrderResult | null>(null);

  async function load() {
    setLoading(true);
    const [sRes, pRes, dRes] = await Promise.all([
      supabase.from('sales').select('*, pizza:pizzas(*)').order('criada_em', { ascending: false }).limit(200),
      supabase.from('pizzas').select('*').eq('ativo', true).order('nome'),
      supabase.from('delivery_orders').select('*, items:delivery_order_items(*)').order('data_pedido', { ascending: false }).limit(200),
    ]);
    setSales((sRes.data ?? []) as Sale[]);
    setPizzas((pRes.data ?? []) as Pizza[]);
    setDeliveryOrders((dRes.data ?? []) as DeliveryOrder[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Realtime: auto-refresh when delivery orders or sales change
  const salesLoadRef = useRef(load);
  salesLoadRef.current = load;
  useEffect(() => {
    const channel = supabase
      .channel('sales-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, () => salesLoadRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_order_items' }, () => salesLoadRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => salesLoadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openNew() {
    setSelectedPizza('');
    setQuantidade('1');
    setResult(null);
    setError(null);
    setDNome('');
    setDTelefone('');
    setDEndereco('');
    setDMotoboy('');
    setDObservacao('');
    setDItems([]);
    setDError(null);
    setDResult(null);
    setDPagamento('dinheiro');
    setModalOpen(true);
  }

  // Presential sale
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    setError(null);
    setResult(null);

    if (!selectedPizza) { setError('Selecione uma pizza'); setRegistering(false); return; }
    const qty = parseInt(quantidade);
    if (!qty || qty < 1) { setError('Quantidade inválida'); setRegistering(false); return; }

    const { data, error: rpcError } = await supabase.rpc('register_sale', {
      p_pizza_id: selectedPizza,
      p_quantidade: qty,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const res = data as RegisterSaleResult;
      if (res?.error) setError(res.error);
      else if (res?.success) { setResult(res); load(); }
      else setError('Resposta inesperada do servidor');
    }
    setRegistering(false);
  }

  // Delivery sale
  function addDeliveryItem(pizza: Pizza) {
    setDItems((prev) => {
      const existing = prev.find((c) => c.pizza.id === pizza.id);
      if (existing) return prev.map((c) => c.pizza.id === pizza.id ? { ...c, quantidade: c.quantidade + 1 } : c);
      return [...prev, { pizza, quantidade: 1 }];
    });
  }

  function updateDeliveryItemQty(id: string, delta: number) {
    setDItems((prev) => prev
      .map((c) => c.pizza.id === id ? { ...c, quantidade: c.quantidade + delta } : c)
      .filter((c) => c.quantidade > 0));
  }

  function removeDeliveryItem(id: string) {
    setDItems((prev) => prev.filter((c) => c.pizza.id !== id));
  }

  const dSubtotal = dItems.reduce((s, c) => s + c.pizza.preco * c.quantidade, 0);
  const dTotal = dSubtotal + (dItems.length > 0 ? TAXA_ENTREGA : 0);

  async function handleRegisterDelivery(e: React.FormEvent) {
    e.preventDefault();
    setDSubmitting(true);
    setDError(null);
    setDResult(null);

    if (!dNome.trim() || !dTelefone.trim() || !dEndereco.trim()) {
      setDError('Preencha nome, telefone e endereço do cliente');
      setDSubmitting(false);
      return;
    }
    if (dItems.length === 0) {
      setDError('Adicione pelo menos um produto');
      setDSubmitting(false);
      return;
    }

    const items = dItems.map((c) => ({
      produto_id: c.pizza.id,
      produto_nome: c.pizza.nome,
      descricao: c.pizza.descricao ?? '',
      quantidade: c.quantidade,
      valor_unitario: c.pizza.preco,
    }));

    const { data, error: rpcError } = await supabase.rpc('create_delivery_order', {
      p_cliente_nome: dNome.trim(),
      p_cliente_telefone: dTelefone.trim(),
      p_cliente_endereco: dEndereco.trim(),
      p_complemento: null,
      p_bairro: null,
      p_observacao: dObservacao.trim() || null,
      p_taxa_entrega: TAXA_ENTREGA,
      p_items: items,
      p_forma_pagamento: dPagamento,
      p_status_pagamento: 'pago',
    });

    if (rpcError) {
      setDError(rpcError.message);
    } else {
      const res = data as CreateDeliveryOrderResult;
      if (res?.error) {
        setDError(res.error);
      } else if (res?.success) {
        setDResult(res);
        // Assign motoboy if provided
        if (dMotoboy.trim() && res.order_id) {
          await supabase.from('delivery_orders').update({ motoboy: dMotoboy.trim() }).eq('id', res.order_id);
        }
        load();
      } else {
        setDError('Erro ao processar pedido');
      }
    }
    setDSubmitting(false);
  }

  async function handleDeleteSale(sale: Sale) {
    if (!confirm('Excluir esta venda? O estoque não será restaurado automaticamente.')) return;
    await supabase.from('sales').delete().eq('id', sale.id);
    load();
  }

  async function updateDeliveryStatus(orderId: string, status: DeliveryStatus) {
    await supabase.from('delivery_orders').update({ status_entrega: status }).eq('id', orderId);
    load();
  }

  async function updateDeliveryMotoboy(orderId: string, motoboy: string) {
    await supabase.from('delivery_orders').update({ motoboy: motoboy || null }).eq('id', orderId);
    load();
  }

  async function handleDeleteDelivery(order: DeliveryOrder) {
    if (!confirm(`Excluir pedido #${order.numero_pedido}?`)) return;
    await supabase.from('delivery_orders').delete().eq('id', order.id);
    load();
  }

  const totalRevenue = sales.reduce((s, x) => s + Number(x.valor_total), 0);
  const totalPizzas = sales.reduce((s, x) => s + x.quantidade, 0);
  const deliveryRevenue = deliveryOrders
    .filter((o) => o.status_entrega !== 'cancelado')
    .reduce((s, o) => s + Number(o.valor_total), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-800 font-display">Vendas</h1>
          <p className="text-ink-500 text-sm mt-0.5">Registre vendas presenciais e entregas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportCSV(deliveryOrders)}
            disabled={deliveryOrders.length === 0}
            className="btn-ghost text-xs"
          >
            <FileSpreadsheet size={16} />
            Exportar CSV
          </button>
          <button onClick={openNew} className="btn-primary">
            <Plus size={18} />
            Registrar Venda
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Vendas Presenciais</p>
            <p className="text-xl font-bold text-ink-800 font-display">{sales.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Pedidos Delivery</p>
            <p className="text-xl font-bold text-ink-800 font-display">{deliveryOrders.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <span className="text-sm font-bold">R$</span>
          </div>
          <div>
            <p className="text-xs text-ink-400">Faturamento Presencial</p>
            <p className="text-xl font-bold text-ink-800 font-display">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Faturamento Delivery</p>
            <p className="text-xl font-bold text-ink-800 font-display">{formatCurrency(deliveryRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ink-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('presencial')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === 'presencial' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          <ShoppingCart size={16} />
          Vendas Presenciais
        </button>
        <button
          onClick={() => setTab('delivery')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === 'delivery' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          <Truck size={16} />
          Pedidos Delivery
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : tab === 'presencial' ? (
        sales.length === 0 ? (
          <div className="card p-12 text-center">
            <ShoppingCart size={40} className="mx-auto text-ink-300 mb-3" />
            <p className="text-ink-500 font-medium">Nenhuma venda registrada</p>
            <p className="text-ink-400 text-sm mt-1">Clique em "Registrar Venda" para comecar</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Pizza</th>
                    <th className="px-5 py-3">Qtd</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Custo</th>
                    <th className="px-5 py-3">Lucro</th>
                    <th className="px-5 py-3">Data/Hora</th>
                    <th className="px-5 py-3 text-right">Acao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sales.map((sale) => {
                    const profit = Number(sale.valor_total) - Number(sale.custo_total);
                    return (
                      <tr key={sale.id} className="hover:bg-ink-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 text-sm font-bold">
                              {sale.pizza?.nome?.charAt(0) ?? '?'}
                            </div>
                            <span className="text-sm font-semibold text-ink-700">{sale.pizza?.nome ?? 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-ink-600">{sale.quantidade}x</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-ink-800">{formatCurrency(Number(sale.valor_total))}</td>
                        <td className="px-5 py-3.5 text-sm text-ink-500">{formatCurrency(Number(sale.custo_total))}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-bold text-emerald-600">{formatCurrency(profit)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-ink-400 flex items-center gap-1">
                          <Clock size={11} />
                          {formatDateTime(sale.criada_em)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button onClick={() => handleDeleteSale(sale)} className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Delivery orders table */
        deliveryOrders.length === 0 ? (
          <div className="card p-12 text-center">
            <Truck size={40} className="mx-auto text-ink-300 mb-3" />
            <p className="text-ink-500 font-medium">Nenhum pedido de delivery</p>
            <p className="text-ink-400 text-sm mt-1">Clique em "Registrar Venda" e escolha a aba Delivery</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Pedido</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Telefone</th>
                    <th className="px-5 py-3">Endereco</th>
                    <th className="px-5 py-3">Motoboy</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Pagamento</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {deliveryOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-ink-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-bold text-brand-600 font-display">#{order.numero_pedido}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-ink-700">{order.cliente_nome}</td>
                      <td className="px-5 py-3.5 text-sm text-ink-500">{order.cliente_telefone}</td>
                      <td className="px-5 py-3.5 text-xs text-ink-500 max-w-[180px] truncate">{order.cliente_endereco}</td>
                      <td className="px-5 py-3.5">
                        <input
                          type="text"
                          defaultValue={order.motoboy ?? ''}
                          onBlur={(e) => updateDeliveryMotoboy(order.id, e.target.value)}
                          placeholder="—"
                          className="w-24 text-xs px-2 py-1.5 rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={order.status_entrega}
                          onChange={(e) => updateDeliveryStatus(order.id, e.target.value as DeliveryStatus)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border-0 cursor-pointer ${statusColors[order.status_entrega]}`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusLabels[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          {(() => {
                            const Icon = order.forma_pagamento ? paymentIcons[order.forma_pagamento] : null;
                            return Icon ? <Icon size={14} className="text-ink-400" /> : null;
                          })()}
                          <span className="text-xs text-ink-500">{order.forma_pagamento ? paymentLabels[order.forma_pagamento] ?? order.forma_pagamento : '—'}</span>
                          {order.pago && <span className="badge text-[9px] bg-emerald-100 text-emerald-700 ml-1">Pago</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-bold text-ink-800">{formatCurrency(Number(order.valor_total))}</td>
                      <td className="px-5 py-3.5 text-xs text-ink-400 whitespace-nowrap">{formatDateTime(order.data_pedido)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => printOrder(order)} className="p-2 rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600 transition-all" title="Imprimir ficha">
                            <Printer size={15} />
                          </button>
                          <button onClick={() => exportPDF(order)} className="p-2 rounded-lg text-ink-400 hover:bg-sky-50 hover:text-sky-600 transition-all" title="Exportar PDF">
                            <FileDown size={15} />
                          </button>
                          <button onClick={() => exportCSV([order])} className="p-2 rounded-lg text-ink-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all" title="Exportar CSV">
                            <FileSpreadsheet size={15} />
                          </button>
                          <button onClick={() => handleDeleteDelivery(order)} className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all" title="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Venda" size="lg">
        {/* Inner tabs */}
        <div className="flex gap-1 bg-ink-100 rounded-xl p-1 mb-5">
          <button
            onClick={() => { setTab('presencial'); }}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              tab === 'presencial' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500'
            }`}
          >
            <ShoppingCart size={16} />
            Presencial
          </button>
          <button
            onClick={() => { setTab('delivery'); }}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              tab === 'delivery' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500'
            }`}
          >
            <Truck size={16} />
            Delivery
          </button>
        </div>

        {tab === 'presencial' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Pizza</label>
              <select value={selectedPizza} onChange={(e) => setSelectedPizza(e.target.value)} className="input" required>
                <option value="">Selecione uma pizza...</option>
                {pizzas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — {formatCurrency(p.preco)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quantidade</label>
              <input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="input" required />
            </div>

            {selectedPizza && parseInt(quantidade) > 0 && (
              <div className="bg-brand-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-700">Total da Venda</span>
                <span className="text-lg font-bold text-brand-700 font-display">
                  {formatCurrency((pizzas.find((p) => p.id === selectedPizza)?.preco ?? 0) * parseInt(quantidade || '0'))}
                </span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <XCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {result?.success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
                <CheckCircle size={16} className="shrink-0" />
                Venda registrada! Total: {formatCurrency(result.valor_total ?? 0)}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 justify-center">Fechar</button>
              <button type="submit" disabled={registering} className="btn-primary flex-1 justify-center">
                {registering ? 'Registrando...' : 'Confirmar Venda'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterDelivery} className="space-y-4">
            {/* Customer data */}
            <div className="bg-ink-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wide flex items-center gap-1.5">
                <User size={14} /> Dados do Cliente
              </p>
              <div>
                <label className="label">Nome do Cliente *</label>
                <input type="text" value={dNome} onChange={(e) => setDNome(e.target.value)} className="input" required placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Telefone *</label>
                  <input type="tel" value={dTelefone} onChange={(e) => setDTelefone(e.target.value)} className="input" required placeholder="(44) 99999-9999" />
                </div>
                <div>
                  <label className="label">Motoboy Responsavel</label>
                  <input type="text" value={dMotoboy} onChange={(e) => setDMotoboy(e.target.value)} className="input" placeholder="Nome do motoboy" />
                </div>
              </div>
              <div>
                <label className="label">Endereco de Entrega *</label>
                <input type="text" value={dEndereco} onChange={(e) => setDEndereco(e.target.value)} className="input" required placeholder="Rua, numero, bairro" />
              </div>
              <div>
                <label className="label">Observacao do Pedido</label>
                <input type="text" value={dObservacao} onChange={(e) => setDObservacao(e.target.value)} className="input" placeholder="Sem cebola, borda recheada..." />
              </div>
              <div>
                <label className="label">Forma de Pagamento *</label>
                <select value={dPagamento} onChange={(e) => setDPagamento(e.target.value as PaymentMethod)} className="input" required>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                </select>
              </div>
            </div>

            {/* Product selection */}
            <div>
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-2">Adicionar Produtos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {pizzas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addDeliveryItem(p)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50 text-sm font-medium text-ink-600 transition-all"
                  >
                    <span className="truncate">{p.nome}</span>
                    <Plus size={14} className="text-brand-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Items list */}
            {dItems.length > 0 && (
              <div className="space-y-2">
                {dItems.map((item) => (
                  <div key={item.pizza.id} className="flex items-center gap-3 bg-ink-50 rounded-xl px-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink-700">{item.pizza.nome}</p>
                      <p className="text-xs text-ink-400">{formatCurrency(item.pizza.preco)} un.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateDeliveryItemQty(item.pizza.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-100 text-sm">-</button>
                      <span className="text-sm font-bold text-ink-700 w-6 text-center">{item.quantidade}</span>
                      <button type="button" onClick={() => updateDeliveryItemQty(item.pizza.id, 1)} className="w-7 h-7 rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-100 text-sm">+</button>
                      <button type="button" onClick={() => removeDeliveryItem(item.pizza.id)} className="ml-1 p-1.5 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {dItems.length > 0 && (
              <div className="bg-brand-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-ink-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(dSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-ink-500">
                  <span>Taxa de Entrega</span>
                  <span>{formatCurrency(TAXA_ENTREGA)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink-800 pt-2 border-t border-brand-200">
                  <span>Total</span>
                  <span className="font-display text-lg">{formatCurrency(dTotal)}</span>
                </div>
              </div>
            )}

            {/* Status note */}
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span className="badge bg-amber-100 text-amber-700">Status inicial: Aguardando</span>
              <span>O podera ser atualizado apos o registro</span>
            </div>

            {dError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <XCircle size={16} className="shrink-0" />
                {dError}
              </div>
            )}

            {dResult?.success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
                <CheckCircle size={16} className="shrink-0" />
                Pedido #{dResult.numero_pedido} registrado! Total: {formatCurrency(dResult.valor_total ?? 0)}
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => {
                    const order = deliveryOrders.find((o) => o.id === dResult.order_id);
                    if (order) printOrder(order);
                  }} className="btn-ghost text-xs py-1.5">
                    <Printer size={14} /> Imprimir
                  </button>
                  <button type="button" onClick={() => {
                    const order = deliveryOrders.find((o) => o.id === dResult.order_id);
                    if (order) exportPDF(order);
                  }} className="btn-ghost text-xs py-1.5">
                    <FileDown size={14} /> PDF
                  </button>
                  <button type="button" onClick={() => {
                    const order = deliveryOrders.find((o) => o.id === dResult.order_id);
                    if (order) exportCSV([order]);
                  }} className="btn-ghost text-xs py-1.5">
                    <FileSpreadsheet size={14} /> CSV
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 justify-center">Fechar</button>
              <button type="submit" disabled={dSubmitting} className="btn-primary flex-1 justify-center">
                {dSubmitting ? 'Registrando...' : 'Confirmar Pedido Delivery'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
