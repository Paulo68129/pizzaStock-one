import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Layout, type Page } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { IngredientsPage } from '@/pages/IngredientsPage';
import { PizzasPage } from '@/pages/PizzasPage';
import { SalesPage } from '@/pages/SalesPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { ForecastPage } from '@/pages/ForecastPage';
import { supabase } from '@/lib/supabase';
import type { Ingredient } from '@/lib/types';

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    async function checkAlerts() {
      const { data } = await supabase.from('ingredients').select('*');
      if (data) {
        const count = (data as Ingredient[]).filter(
          (i) => Number(i.estoque) <= Number(i.estoque_minimo)
        ).length;
        setAlertCount(count);
      }
    }
    checkAlerts();
  }, [session, page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm text-ink-400 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Layout current={page} onNavigate={setPage} alertCount={alertCount}>
      {page === 'dashboard' && <DashboardPage />}
      {page === 'ingredients' && <IngredientsPage />}
      {page === 'pizzas' && <PizzasPage />}
      {page === 'sales' && <SalesPage />}
      {page === 'analytics' && <AnalyticsPage />}
      {page === 'alerts' && <AlertsPage />}
      {page === 'forecast' && <ForecastPage />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
