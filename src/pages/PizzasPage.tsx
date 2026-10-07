import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Pizza as PizzaIcon, Search, X, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { Pizza, Ingredient, RecipeItem } from '@/lib/types';

export function PizzasPage() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pizza | null>(null);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipePizza, setRecipePizza] = useState<Pizza | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [newIngId, setNewIngId] = useState('');
  const [newQty, setNewQty] = useState('');
  const [recipeError, setRecipeError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pRes, iRes, rRes] = await Promise.all([
      supabase.from('pizzas').select('*').order('nome'),
      supabase.from('ingredients').select('*').order('nome'),
      supabase.from('recipe_items').select('*, ingredient:ingredients(*)'),
    ]);

    const pList = (pRes.data ?? []) as Pizza[];
    const iList = (iRes.data ?? []) as Ingredient[];
    const rList = (rRes.data ?? []) as RecipeItem[];
    setPizzas(pList);
    setIngredients(iList);
    const rMap: Record<string, RecipeItem[]> = {};
    rList.forEach((r) => {
      if (!rMap[r.pizza_id]) rMap[r.pizza_id] = [];
      rMap[r.pizza_id].push(r);
    });
    setRecipes(rMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setNome('');
    setPreco('');
    setAtivo(true);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: Pizza) {
    setEditing(p);
    setNome(p.nome);
    setPreco(String(p.preco));
    setAtivo(p.ativo);
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nome: nome.trim(),
      preco: parseFloat(preco) || 0,
      ativo,
    };

    if (!payload.nome) {
      setError('Informe o nome da pizza');
      setSaving(false);
      return;
    }

    if (editing) {
      const { error } = await supabase.from('pizzas').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('pizzas').insert(payload);
      if (error) setError(error.message);
    }

    setSaving(false);
    if (!error) {
      setModalOpen(false);
      load();
    }
  }

  async function handleDelete(p: Pizza) {
    if (!confirm(`Excluir "${p.nome}"? A receita também será removida.`)) return;
    await supabase.from('pizzas').delete().eq('id', p.id);
    load();
  }

  async function toggleAtivo(p: Pizza) {
    await supabase.from('pizzas').update({ ativo: !p.ativo }).eq('id', p.id);
    load();
  }

  function openRecipe(p: Pizza) {
    setRecipePizza(p);
    setRecipeItems(recipes[p.id] ?? []);
    setNewIngId('');
    setNewQty('');
    setRecipeError(null);
    setRecipeModalOpen(true);
  }

  async function addRecipeItem() {
    if (!newIngId || !newQty) {
      setRecipeError('Selecione um ingrediente e informe a quantidade');
      return;
    }
    if (recipeItems.some((r) => r.ingrediente_id === newIngId)) {
      setRecipeError('Este ingrediente já está na receita');
      return;
    }
    if (!recipePizza) return;

    const { data, error } = await supabase
      .from('recipe_items')
      .insert({
        pizza_id: recipePizza.id,
        ingrediente_id: newIngId,
        quantidade: parseFloat(newQty),
      })
      .select('*, ingredient:ingredients(*)')
      .single();

    if (error) {
      setRecipeError(error.message);
      return;
    }

    setRecipeItems([...recipeItems, data as RecipeItem]);
    setNewIngId('');
    setNewQty('');
    setRecipeError(null);
    load();
  }

  async function removeRecipeItem(item: RecipeItem) {
    await supabase.from('recipe_items').delete().eq('id', item.id);
    setRecipeItems(recipeItems.filter((r) => r.id !== item.id));
    load();
  }

  function calcPizzaCost(pizzaId: string): number {
    const items = recipes[pizzaId] ?? [];
    return items.reduce((sum, r) => sum + r.quantidade * (r.ingredient?.custo_unitario ?? 0), 0);
  }

  const filtered = pizzas.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-800 font-display">Cardápio</h1>
          <p className="text-ink-500 text-sm mt-0.5">Gerencie pizzas, preços e receitas</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} />
          Nova Pizza
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pizza..."
          className="input pl-11"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <PizzaIcon size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500 font-medium">Nenhuma pizza encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => {
            const cost = calcPizzaCost(p.id);
            const margin = p.preco > 0 ? ((p.preco - cost) / p.preco) * 100 : 0;
            const recipeCount = recipes[p.id]?.length ?? 0;
            return (
              <div key={p.id} className={`card p-5 animate-slide-up ${!p.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                      <PizzaIcon size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-ink-800">{p.nome}</h3>
                      <span className={`badge ${p.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600 transition-all">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-ink-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-ink-400">Preço</p>
                    <p className="text-lg font-bold text-ink-800 font-display">{formatCurrency(p.preco)}</p>
                  </div>
                  <div className="bg-ink-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-ink-400">Custo</p>
                    <p className="text-lg font-bold text-ink-600 font-display">{formatCurrency(cost)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-ink-500">Margem</span>
                  <span className={`font-bold ${margin >= 50 ? 'text-emerald-600' : margin >= 30 ? 'text-amber-600' : 'text-red-500'}`}>
                    {margin.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-ink-500">Receita</span>
                  <span className="text-ink-600 font-medium">{recipeCount} ingrediente{recipeCount !== 1 ? 's' : ''}</span>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => openRecipe(p)} className="btn-ghost flex-1 justify-center text-xs">
                    <DollarSign size={14} />
                    Editar Receita
                  </button>
                  <button
                    onClick={() => toggleAtivo(p)}
                    className="btn-ghost text-xs"
                  >
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pizza modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Pizza' : 'Nova Pizza'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nome da Pizza</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Calabresa Especial"
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Preço (R$)</label>
            <input
              type="number"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0.00"
              className="input"
              required
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-5 h-5 rounded-lg border-ink-300 text-brand-500 focus:ring-brand-400"
            />
            <span className="text-sm text-ink-600 font-medium">Pizza ativa no cardápio</span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Recipe modal */}
      <Modal open={recipeModalOpen} onClose={() => setRecipeModalOpen(false)} title={`Receita: ${recipePizza?.nome ?? ''}`} size="lg">
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-ink-600 mb-3">Adicionar Ingrediente</h4>
            <div className="flex gap-3">
              <select value={newIngId} onChange={(e) => setNewIngId(e.target.value)} className="input flex-1">
                <option value="">Selecione...</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="Qtd"
                className="input w-24"
              />
              <button type="button" onClick={addRecipeItem} className="btn-primary">
                <Plus size={16} />
              </button>
            </div>
            {recipeError && <p className="text-xs text-red-500 mt-2">{recipeError}</p>}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-ink-600 mb-3">Ingredientes da Receita</h4>
            {recipeItems.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-6 bg-ink-50 rounded-xl">Nenhum ingrediente adicionado</p>
            ) : (
              <div className="space-y-2">
                {recipeItems.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-ink-50 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold">
                      {r.ingredient?.nome?.charAt(0) ?? '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink-700">{r.ingredient?.nome}</p>
                      <p className="text-xs text-ink-400">{formatCurrency(Number(r.ingredient?.custo_unitario ?? 0))} / {r.ingredient?.unidade}</p>
                    </div>
                    <span className="text-sm font-bold text-ink-700">{formatNumber(r.quantidade)} {r.ingredient?.unidade}</span>
                    <span className="text-sm text-ink-500">{formatCurrency(r.quantidade * Number(r.ingredient?.custo_unitario ?? 0))}</span>
                    <button onClick={() => removeRecipeItem(r)} className="p-1.5 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {recipeItems.length > 0 && (
            <div className="bg-brand-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-700">Custo Total por Pizza</span>
              <span className="text-lg font-bold text-brand-700 font-display">
                {formatCurrency(recipeItems.reduce((s, r) => s + r.quantidade * Number(r.ingredient?.custo_unitario ?? 0), 0))}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
