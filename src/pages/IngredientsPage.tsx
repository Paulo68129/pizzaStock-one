import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { formatCurrency, formatNumber, formatDate, getExpiryStatus, daysUntil } from '@/lib/format';
import type { Ingredient } from '@/lib/types';

const emptyForm = {
  nome: '',
  estoque: '',
  unidade: 'kg',
  estoque_minimo: '',
  custo_unitario: '',
  data_validade: '',
};

export function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ingredients').select('*').order('nome');
    setIngredients((data ?? []) as Ingredient[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      nome: ing.nome,
      estoque: String(ing.estoque),
      unidade: ing.unidade,
      estoque_minimo: String(ing.estoque_minimo),
      custo_unitario: String(ing.custo_unitario),
      data_validade: ing.data_validade ? ing.data_validade.slice(0, 10) : '',
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nome: form.nome.trim(),
      estoque: parseFloat(form.estoque) || 0,
      unidade: form.unidade,
      estoque_minimo: parseFloat(form.estoque_minimo) || 0,
      custo_unitario: parseFloat(form.custo_unitario) || 0,
      data_validade: form.data_validade ? new Date(form.data_validade).toISOString() : null,
    };

    if (!payload.nome) {
      setError('Informe o nome do ingrediente');
      setSaving(false);
      return;
    }

    if (editing) {
      const { error } = await supabase.from('ingredients').update(payload).eq('id', editing.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('ingredients').insert(payload);
      if (error) setError(error.message);
    }

    setSaving(false);
    if (!error) {
      setModalOpen(false);
      load();
    }
  }

  async function handleDelete(ing: Ingredient) {
    if (!confirm(`Excluir "${ing.nome}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('ingredients').delete().eq('id', ing.id);
    load();
  }

  const filtered = ingredients.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase())
  );

  const expiryColors: Record<string, string> = {
    expired: 'bg-red-100 text-red-700',
    critical: 'bg-orange-100 text-orange-700',
    warning: 'bg-amber-100 text-amber-700',
    ok: 'bg-emerald-100 text-emerald-700',
    none: 'bg-ink-100 text-ink-500',
  };

  const expiryLabels: Record<string, string> = {
    expired: 'Vencido',
    critical: 'Crítico',
    warning: 'Atenção',
    ok: 'OK',
    none: 'Sem validade',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-800 font-display">Controle de Estoque</h1>
          <p className="text-ink-500 text-sm mt-0.5">Gerencie ingredientes, quantidades e validades</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} />
          Novo Ingrediente
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ingrediente..."
          className="input pl-11"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={40} className="mx-auto text-ink-300 mb-3" />
          <p className="text-ink-500 font-medium">Nenhum ingrediente encontrado</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-ink-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Ingrediente</th>
                  <th className="px-5 py-3">Estoque</th>
                  <th className="px-5 py-3">Mínimo</th>
                  <th className="px-5 py-3">Custo Unit.</th>
                  <th className="px-5 py-3">Validade</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((ing) => {
                  const expStatus = getExpiryStatus(ing.data_validade);
                  const days = daysUntil(ing.data_validade);
                  const lowStock = Number(ing.estoque) <= Number(ing.estoque_minimo);
                  return (
                    <tr key={ing.id} className="hover:bg-ink-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${lowStock ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-500'}`}>
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink-700">{ing.nome}</p>
                            {lowStock && (
                              <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
                                <AlertTriangle size={10} /> Estoque baixo
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-bold ${lowStock ? 'text-red-500' : 'text-ink-700'}`}>
                          {formatNumber(Number(ing.estoque))} {ing.unidade}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-ink-500">
                        {formatNumber(Number(ing.estoque_minimo))} {ing.unidade}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-ink-600 font-medium">
                        {formatCurrency(Number(ing.custo_unitario))}
                      </td>
                      <td className="px-5 py-3.5">
                        {ing.data_validade ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-ink-500 flex items-center gap-1">
                              <Calendar size={11} />
                              {formatDate(ing.data_validade)}
                            </span>
                            <span className={`badge text-[10px] ${expiryColors[expStatus]}`}>
                              {expiryLabels[expStatus]}
                              {days !== null && days >= 0 && expStatus !== 'expired' ? ` (${days}d)` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(ing)}
                            className="p-2 rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600 transition-all"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(ing)}
                            className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Ingrediente' : 'Novo Ingrediente'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Mussarela"
              className="input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estoque Atual</label>
              <input
                type="number"
                step="0.001"
                value={form.estoque}
                onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                placeholder="0"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Unidade</label>
              <select
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                className="input"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="un">un</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Estoque Mínimo</label>
              <input
                type="number"
                step="0.001"
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
                placeholder="0"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Custo Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
                placeholder="0.00"
                className="input"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Data de Validade</label>
            <input
              type="date"
              value={form.data_validade}
              onChange={(e) => setForm({ ...form, data_validade: e.target.value })}
              className="input"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 justify-center">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
