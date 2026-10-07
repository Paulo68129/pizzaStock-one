import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Pizza, Sale, RegisterSaleResult } from '@/lib/types';

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPizza, setSelectedPizza] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<RegisterSaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [sRes, pRes] = await Promise.all([
      supabase.from('sales').select('*, pizza:pizzas(*)').order('criada_em', { ascending: false }).limit(200),
      supabase.from('pizzas').select('*').eq('ativo', true).order('nome'),
    ]);
    setSales((sRes.data ?? []) as Sale[]);
    setPizzas((pRes.data ?? []) as Pizza[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setSelectedPizza('');
    setQuantidade('1');
    setResult(null);
    setError(null);
    setModalOpen(true);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    setError(null);
    setResult(null);

    if (!selectedPizza) {
      setError('Selecione uma pizza');
      setRegistering(false);
      return;
    }

    const qty = parseInt(quantidade);
    if (!qty || qty < 1) {
      setError('Quantidade inválida');
      setRegistering(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('register_sale', {
      p_pizza_id: selectedPizza,
      p_quantidade: qty,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const res = data as RegisterSaleResult;
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setResult(res);
        load();
      } else {
        setError('Resposta inesperada do servidor');
      }
    }
    setRegistering(false);
  }

  async function handleDelete(sale: Sale) {
    if (!confirm('Excluir esta venda? O estoque não será restaurado automaticamente.')) return;
    await supabase.from('sales').delete().eq('id', sale.id);
    load();
  }

  const totalRevenue = sales.reduce((s, x) => s + Number(x.valor_total), 0);
  const totalPizzas = sales.reduce((s, x) => s + x.quantidade, 0);
  const totalProfit = sales.reduce((s, x) => s + (Number(x.valor_total) - Number(x.custo_total)), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-800 font-display">Vendas</h1>
          <p className="text-ink-500 text-sm mt-0.5">Registre vendas e acompanhe o histórico</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} />
          Registrar Venda
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-xs text-ink-400">Total de Vendas</p>
            <p className="text-xl font-bold text-ink-800 font-display">{sales.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <span className="text-sm font-bold">R$</span>
          </div>
          <div>
            <p className="text-xs text-ink-400">Faturamento Total</p>
            <p className="text-xl font-bold text-ink-800 font-display">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <span className="text-sm font-bold">P</span>
          </div>
          <div>
            <p className="text-xs text-ink-400">Pizzas Vendidas</p>
            <p className="text-xl font-bold text-ink-800 font-display">{totalPizzas}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingCart size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500 font-medium">Nenhuma venda registrada</p>
          <p className="text-ink-400 text-sm mt-1">Clique em "Registrar Venda" para começar</p>
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
                  <th className="px-5 py-3 text-right">Ação</th>
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
                        <button onClick={() => handleDelete(sale)} className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all">
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
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Venda" size="sm">
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
            <input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="input"
              required
            />
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
      </Modal>
    </div>
  );
}
