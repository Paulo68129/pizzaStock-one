import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Package,
  Pizza,
  ShoppingCart,
  BarChart3,
  Bell,
  Brain,
  LogOut,
  Menu,
  X,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

export type Page = 'dashboard' | 'ingredients' | 'pizzas' | 'sales' | 'analytics' | 'alerts' | 'forecast';

interface LayoutProps {
  current: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
  alertCount?: number;
}

const navItems: { id: Page; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'ingredients', label: 'Estoque', icon: <Package size={18} /> },
  { id: 'pizzas', label: 'Cardápio', icon: <Pizza size={18} /> },
  { id: 'sales', label: 'Vendas', icon: <ShoppingCart size={18} /> },
  { id: 'analytics', label: 'Análises', icon: <BarChart3 size={18} /> },
  { id: 'alerts', label: 'Alertas', icon: <Bell size={18} /> },
  { id: 'forecast', label: 'Previsão IA', icon: <Brain size={18} /> },
];

const perfilLabel: Record<string, string> = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  atendente: 'Atendente',
};

export function Layout({ current, onNavigate, children, alertCount = 0 }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleNav(page: Page) {
    onNavigate(page);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-ink-200/60 fixed h-screen z-30">
        <div className="px-6 py-5 flex items-center gap-2.5 border-b border-ink-100">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-sm">
            <Flame size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-ink-800 text-lg leading-tight">PizzaStock</h1>
            <p className="text-[11px] text-ink-400 font-medium tracking-wide">Sistema de Gestão</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`nav-item w-full text-left ${current === item.id ? 'nav-item-active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === 'alerts' && alertCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-ink-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
              {profile?.nome?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-700 truncate">{profile?.nome}</p>
              <p className="text-xs text-ink-400">{profile ? perfilLabel[profile.perfil] : ''}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500 transition-all"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-ink-200/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
            <Flame size={18} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-ink-800">PizzaStock</h1>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-ink-600 hover:bg-ink-100">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white animate-slide-in-right flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-ink-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
                  <Flame size={18} className="text-white" />
                </div>
                <h1 className="font-display font-bold text-ink-800">PizzaStock</h1>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-ink-400 hover:bg-ink-100">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`nav-item w-full text-left ${current === item.id ? 'nav-item-active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'alerts' && alertCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {alertCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-ink-100">
              <div className="flex items-center gap-3 px-2">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm">
                  {profile?.nome?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-700 truncate">{profile?.nome}</p>
                  <p className="text-xs text-ink-400">{profile ? perfilLabel[profile.perfil] : ''}</p>
                </div>
                <button onClick={signOut} className="p-2 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </div>
    </div>
  );
}
