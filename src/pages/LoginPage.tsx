import { useState } from 'react';
import { Flame, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error === 'Invalid login credentials' ? 'Email ou senha incorretos' : error);
    } else {
      if (nome.trim().length < 2) {
        setError('Informe seu nome');
        setLoading(false);
        return;
      }
      const { error } = await signUp(nome.trim(), email, password);
      if (error) setError(error);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Flame size={26} />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl">PizzaStockAI</h1>
              <p className="text-white/70 text-sm">Sistema de Gestão Inteligente</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="font-display font-bold text-4xl leading-tight mb-4">
              Gerencie sua pizzaria com inteligência artificial
            </h2>
            <p className="text-white/80 text-lg leading-relaxed">
              Controle de estoque, vendas, análises financeiras e previsões de demanda em um só lugar.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Controle de estoque em tempo real',
                'Alertas de validade automáticos',
                'Relatórios financeiros detalhados',
                'Previsões de demanda com IA',
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-white/90">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="text-sm font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/50 text-xs">© 2026 PizzaStockAI. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-ink-50">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center">
              <Flame size={22} className="text-white" />
            </div>
            <h1 className="font-display font-bold text-ink-800 text-xl">PizzaStockAI</h1>
          </div>

          <h2 className="font-display font-bold text-2xl text-ink-800 mb-1">
            {mode === 'signin' ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h2>
          <p className="text-ink-500 text-sm mb-8">
            {mode === 'signin' ? 'Acesse o painel de gestão da sua pizzaria' : 'Cadastre-se para começar a usar o sistema'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Nome completo</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    className="input pl-11"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="input pl-11"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-11 pr-11"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl animate-fade-in">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
              {loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-ink-500 mt-6">
            {mode === 'signin' ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
            >
              {mode === 'signin' ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
