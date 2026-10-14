import { useEffect, useState, useRef } from 'react';
import {
  Flame,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle,
  Search,
  Truck,
  Phone,
  MapPin,
  User,
  StickyNote,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import type { Pizza, CartItem, CreateDeliveryOrderResult, PaymentMethod } from '@/lib/types';

const TAXA_ENTREGA = 6.0;

const paymentOptions: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'pix', label: 'Pix', icon: Smartphone },
  { value: 'cartao', label: 'Cartão', icon: CreditCard },
];

function logOrderFlow(stage: string, data: Record<string, unknown>, isError = false) {
  const prefix = isError ? '[DELIVERY ERROR]' : '[DELIVERY FLOW]';
  if (isError) {
    console.error(`${prefix} ${stage}`, data);
  } else {
    console.log(`${prefix} ${stage}`, data);
  }
}

export function DeliveryPage() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [successOrder, setSuccessOrder] = useState<CreateDeliveryOrderResult | null>(null);

  // Customer form
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [observacao, setObservacao] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('dinheiro');

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase.from('pizzas').select('*').eq('ativo', true).order('categoria, nome');
      if (loadError) {
        logOrderFlow('catalog_load_error', { error: loadError.message }, true);
      }
      setPizzas((data ?? []) as Pizza[]);
      setLoading(false);
    }
    load();
  }, []);

  // Realtime: auto-refresh catalog when pizzas table changes
  useEffect(() => {
    const channel = supabase
      .channel('delivery-catalog-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pizzas' }, async () => {
        const { data } = await supabase.from('pizzas').select('*').eq('ativo', true).order('categoria, nome');
        setPizzas((data ?? []) as Pizza[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const categories = ['all', ...Array.from(new Set(pizzas.map((p) => p.categoria ?? 'Outros'))).sort()];

  const filtered = pizzas.filter((p) => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.descricao ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || (p.categoria ?? 'Outros') === activeCategory;
    return matchesSearch && matchesCat;
  });

  const featured = pizzas.filter((p) => p.destaque);

  function addToCart(pizza: Pizza) {
    setCart((prev) => {
      const existing = prev.find((c) => c.pizza.id === pizza.id);
      if (existing) {
        return prev.map((c) => (c.pizza.id === pizza.id ? { ...c, quantidade: c.quantidade + 1 } : c));
      }
      return [...prev, { pizza, quantidade: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.pizza.id === id ? { ...c, quantidade: c.quantidade + delta } : c))
        .filter((c) => c.quantidade > 0)
    );
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.pizza.id !== id));
  }

  const cartCount = cart.reduce((s, c) => s + c.quantidade, 0);
  const subtotal = cart.reduce((s, c) => s + c.pizza.preco * c.quantidade, 0);
  const total = subtotal + (cart.length > 0 ? TAXA_ENTREGA : 0);

  function openCheckout() {
    if (cart.length === 0) return;
    setError(null);
    setErrorCode(null);
    setCheckoutMode(true);
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrorCode(null);

    // Client-side validation
    if (!nome.trim() || !telefone.trim() || !endereco.trim()) {
      setError('Preencha nome, telefone e endereço');
      setErrorCode('VALIDATION');
      logOrderFlow('validation_failed', { nome: !!nome.trim(), telefone: !!telefone.trim(), endereco: !!endereco.trim() }, true);
      setSubmitting(false);
      return;
    }

    if (cart.length === 0) {
      setError('Carrinho vazio. Adicione produtos antes de finalizar.');
      setErrorCode('EMPTY_CART');
      setSubmitting(false);
      return;
    }

    const items = cart.map((c) => ({
      produto_id: c.pizza.id,
      produto_nome: c.pizza.nome,
      descricao: c.pizza.descricao ?? '',
      quantidade: c.quantidade,
      valor_unitario: c.pizza.preco,
    }));

    // Items must be passed as a JSON object array, NOT a stringified string
    // supabase.rpc handles JSON serialization automatically
    const rpcParams = {
      p_cliente_nome: nome.trim(),
      p_cliente_telefone: telefone.trim(),
      p_cliente_endereco: endereco.trim(),
      p_complemento: complemento.trim() || null,
      p_bairro: bairro.trim() || null,
      p_observacao: observacao.trim() || null,
      p_taxa_entrega: TAXA_ENTREGA,
      p_items: items,
      p_forma_pagamento: formaPagamento,
      p_status_pagamento: 'pago' as const,
    };

    logOrderFlow('submit_start', {
      items: items.length,
      total,
      cliente: nome.trim(),
      pagamento: formaPagamento,
    });

    try {
      const { data, error: rpcError } = await supabase.rpc('create_delivery_order', rpcParams);

      if (rpcError) {
        logOrderFlow('rpc_error', { message: rpcError.message, code: rpcError.code, details: rpcError.details }, true);
        // Provide user-friendly error messages
        let userMsg = rpcError.message;
        if (rpcError.message.includes('Could not convert')) {
          userMsg = 'Erro ao processar os dados do pedido. Verifique os itens e tente novamente.';
        } else if (rpcError.message.includes('function does not exist')) {
          userMsg = 'Sistema temporariamente indisponível. Tente novamente em instantes.';
        } else if (rpcError.message.includes('permission denied') || rpcError.message.includes('JWT')) {
          userMsg = 'Erro de autenticação. Recarregue a página e tente novamente.';
        }
        setError(userMsg);
        setErrorCode('RPC_ERROR');
        setSubmitting(false);
        return;
      }

      const res = data as CreateDeliveryOrderResult;

      if (res?.error) {
        logOrderFlow('server_error', { error: res.error, code: res.error_code }, true);

        // Map server errors to user-friendly messages
        let userMsg = res.error;
        if (res.error_code === 'INSUFFICIENT_STOCK') {
          userMsg = `Estoque insuficiente para alguns ingredientes. ${res.error}`;
        } else if (res.error_code === 'EXPIRED_INGREDIENTS') {
          userMsg = `Alguns ingredientes estão vencidos. ${res.error}`;
        } else if (res.error_code === 'PRODUCT_NOT_FOUND') {
          userMsg = 'Um dos produtos não está mais disponível. Recarregue a página.';
        }

        setError(userMsg);
        setErrorCode(res.error_code ?? 'SERVER_ERROR');
        setSubmitting(false);
        return;
      }

      if (!res?.success) {
        logOrderFlow('unexpected_response', { data }, true);
        setError('Resposta inesperada do servidor. Tente novamente.');
        setErrorCode('UNEXPECTED_RESPONSE');
        setSubmitting(false);
        return;
      }

      // Success!
      logOrderFlow('success', {
        order_id: res.order_id,
        numero_pedido: res.numero_pedido,
        valor_total: res.valor_total,
        item_count: res.item_count,
      });

      setSuccessOrder(res);
      setCart([]);
      setCheckoutMode(false);
      setRetryCount(0);
      setNome('');
      setTelefone('');
      setEndereco('');
      setComplemento('');
      setBairro('');
      setObservacao('');
    } catch (err) {
      logOrderFlow('exception', { error: err instanceof Error ? err.message : String(err) }, true);
      setError('Falha de comunicação com o servidor. Verifique sua conexão e tente novamente.');
      setErrorCode('NETWORK_ERROR');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setRetryCount((c) => c + 1);
    setError(null);
    setErrorCode(null);
  }

  // If success screen is showing
  if (successOrder) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full card p-8 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <CheckCircle size={36} />
          </div>
          <h2 className="text-2xl font-bold text-ink-800 font-display mb-2">Pedido Confirmado!</h2>
          <p className="text-ink-500 mb-4">Seu pedido foi registrado com sucesso e marcado como <strong>Recebido</strong> no sistema.</p>
          <div className="bg-brand-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-brand-600 font-medium">Número do Pedido</p>
            <p className="text-3xl font-bold text-brand-700 font-display">#{successOrder.numero_pedido}</p>
            <p className="text-sm text-ink-500 mt-2">Total: {formatCurrency(successOrder.valor_total ?? 0)}</p>
            <p className="text-sm text-ink-500">Pagamento: {successOrder.forma_pagamento === 'dinheiro' ? 'Dinheiro' : successOrder.forma_pagamento === 'pix' ? 'Pix' : successOrder.forma_pagamento === 'cartao' ? 'Cartão' : '—'}</p>
            <p className="text-sm text-emerald-600 font-medium mt-1">Status do Pagamento: Pago</p>
          </div>
          <p className="text-sm text-ink-400 mb-6">
            Aguarde nosso contato para confirmação. O status do pedido pode ser acompanhado pelo número acima.
          </p>
          <button
            onClick={() => setSuccessOrder(null)}
            className="btn-primary w-full justify-center"
          >
            Fazer Novo Pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Header */}
      <header className="bg-white border-b border-ink-200/60 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-sm">
              <Flame size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-ink-800 text-lg leading-tight">PizzaStock</h1>
              <p className="text-[11px] text-ink-400 font-medium">Delivery Online</p>
            </div>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-all active:scale-[0.98]"
          >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">Carrinho</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-ink-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 relative z-10">
          <h2 className="font-display font-bold text-3xl sm:text-4xl mb-2">Peça sua pizza online</h2>
          <p className="text-white/80 text-base sm:text-lg">Entrega rápida e quentinha na sua casa. Taxa de entrega: {formatCurrency(TAXA_ENTREGA)}</p>
        </div>
      </div>

      {/* Featured */}
      {featured.length > 0 && activeCategory === 'all' && !search && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h3 className="text-lg font-bold text-ink-800 font-display mb-4 flex items-center gap-2">
            <Flame size={20} className="text-brand-500" />
            Destaques
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((pizza) => (
              <ProductCard key={pizza.id} pizza={pizza} onAdd={() => addToCart(pizza)} />
            ))}
          </div>
        </div>
      )}

      {/* Catalog */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="input pl-11"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-ink-500 border border-ink-200 hover:border-brand-300'
                }`}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Package size={40} className="mx-auto text-ink-300 mb-3" />
            <p className="text-ink-500 font-medium">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((pizza) => (
              <ProductCard key={pizza.id} pizza={pizza} onAdd={() => addToCart(pizza)} />
            ))}
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={() => { setCartOpen(false); setCheckoutMode(false); }} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white animate-slide-in-right flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-ink-100">
              <h3 className="font-bold text-ink-800 text-lg">
                {checkoutMode ? 'Finalizar Pedido' : 'Seu Carrinho'}
              </h3>
              <button onClick={() => { setCartOpen(false); setCheckoutMode(false); }} className="p-2 rounded-lg text-ink-400 hover:bg-ink-100">
                <X size={20} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <ShoppingCart size={48} className="text-ink-300 mb-3" />
                <p className="text-ink-500 font-medium">Seu carrinho está vazio</p>
                <p className="text-ink-400 text-sm mt-1">Adicione produtos do catálogo</p>
              </div>
            ) : checkoutMode ? (
              <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="label">Nome Completo *</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="input pl-11" required placeholder="Seu nome" />
                  </div>
                </div>
                <div>
                  <label className="label">Telefone *</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="input pl-11" required placeholder="(44) 99999-9999" />
                  </div>
                </div>
                <div>
                  <label className="label">Endereço de Entrega *</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} className="input pl-11" required placeholder="Rua, número" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Complemento</label>
                    <input type="text" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="input" placeholder="Apto, bloco" />
                  </div>
                  <div>
                    <label className="label">Bairro</label>
                    <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} className="input" placeholder="Centro" />
                  </div>
                </div>
                <div>
                  <label className="label">Observação do Pedido</label>
                  <div className="relative">
                    <StickyNote size={18} className="absolute left-3.5 top-3.5 text-ink-400" />
                    <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="input pl-11 min-h-[70px] resize-none" placeholder="Sem cebola, borda recheada..." />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="label">Forma de Pagamento *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentOptions.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormaPagamento(opt.value)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                            formaPagamento === opt.value
                              ? 'border-brand-500 bg-brand-50 text-brand-600'
                              : 'border-ink-200 text-ink-500 hover:border-brand-300'
                          }`}
                        >
                          <Icon size={20} />
                          <span className="text-xs font-semibold">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-ink-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-ink-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-ink-500">
                    <span>Taxa de Entrega</span>
                    <span>{formatCurrency(TAXA_ENTREGA)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink-800 pt-2 border-t border-ink-200">
                    <span>Total</span>
                    <span className="font-display text-lg">{formatCurrency(total)}</span>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                    {(errorCode === 'NETWORK_ERROR' || errorCode === 'RPC_ERROR' || errorCode === 'UNEXPECTED_RESPONSE') && (
                      <button type="button" onClick={handleRetry} className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-800 ml-6">
                        <RotateCw size={12} /> Tentar novamente{retryCount > 0 ? ` (${retryCount}x)` : ''}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setCheckoutMode(false)} className="btn-ghost flex-1 justify-center">
                    Voltar
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                    {submitting ? 'Enviando...' : 'Confirmar Pedido'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {cart.map((item) => (
                    <div key={item.pizza.id} className="flex items-start gap-3 bg-ink-50 rounded-xl p-3">
                      {item.pizza.imagem_url && (
                        <img src={item.pizza.imagem_url} alt={item.pizza.nome} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-700 truncate">{item.pizza.nome}</p>
                        <p className="text-sm text-brand-600 font-bold">{formatCurrency(item.pizza.preco)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQty(item.pizza.id, -1)} className="w-7 h-7 rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-100">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-bold text-ink-700 w-6 text-center">{item.quantidade}</span>
                          <button onClick={() => updateQty(item.pizza.id, 1)} className="w-7 h-7 rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-100">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => removeFromCart(item.pizza.id)} className="ml-auto p-1.5 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-ink-100 p-5 space-y-3">
                  <div className="flex justify-between text-sm text-ink-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-ink-500">
                    <span className="flex items-center gap-1"><Truck size={14} /> Taxa de Entrega</span>
                    <span>{formatCurrency(TAXA_ENTREGA)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink-800 pt-2 border-t border-ink-200">
                    <span>Total</span>
                    <span className="font-display text-xl">{formatCurrency(total)}</span>
                  </div>
                  <button onClick={openCheckout} className="btn-primary w-full justify-center py-3">
                    Finalizar Pedido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-ink-900 text-ink-400 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame size={18} className="text-brand-500" />
            <span className="font-display font-bold text-white">PizzaStockAI</span>
          </div>
          <p className="text-xs">Controle Inteligente de Vendas e Entregas</p>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ pizza, onAdd }: { pizza: Pizza; onAdd: () => void }) {
  return (
    <div className="card overflow-hidden hover:shadow-md transition-shadow group">
      {pizza.imagem_url ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={pizza.imagem_url}
            alt={pizza.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {pizza.destaque && (
            <span className="absolute top-3 left-3 badge bg-brand-500 text-white shadow-sm">
              <Flame size={11} /> Destaque
            </span>
          )}
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-brand-100 to-amber-100 flex items-center justify-center">
          <Package size={40} className="text-brand-300" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-bold text-ink-800">{pizza.nome}</h4>
          {pizza.categoria && (
            <span className="badge bg-ink-100 text-ink-500 text-[10px] shrink-0">{pizza.categoria}</span>
          )}
        </div>
        {pizza.descricao && (
          <p className="text-sm text-ink-500 leading-relaxed mb-3 line-clamp-2">{pizza.descricao}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-brand-600 font-display">{formatCurrency(pizza.preco)}</span>
          <button onClick={onAdd} className="btn-primary py-2 px-3 text-xs">
            <Plus size={16} />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
