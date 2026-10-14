import { useState, useEffect, useRef, useCallback } from 'react';
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
import { DeliveryPage } from '@/pages/DeliveryPage';
import { DeliveryDashboardPage } from '@/pages/DeliveryDashboardPage';
import { NotificationSettingsPanel } from '@/components/NotificationSettingsPanel';
import { OrderToast } from '@/components/OrderToast';
import { supabase } from '@/lib/supabase';
import {
  type NotificationSettings,
  loadSettings,
  saveSettings,
  playNotificationSound,
  unlockAudio,
} from '@/lib/notificationSound';
import type { Ingredient, DeliveryOrder } from '@/lib/types';
import { Settings } from 'lucide-react';

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [alertCount, setAlertCount] = useState(0);
  const [deliveryPendingCount, setDeliveryPendingCount] = useState(0);
  const [isPublicDelivery, setIsPublicDelivery] = useState(false);

  // Notification settings
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOrderToast, setNewOrderToast] = useState<DeliveryOrder | null>(null);

  // Track known order IDs so we only alert on genuinely NEW orders
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    function checkHash() {
      setIsPublicDelivery(window.location.hash === '#delivery');
    }
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Unlock audio on first user interaction (browser requirement)
  useEffect(() => {
    function handleInteraction() {
      unlockAudio();
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    }
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

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

    async function checkDeliveryPending() {
      const { data } = await supabase
        .from('delivery_orders')
        .select('id, status_entrega')
        .order('data_pedido', { ascending: false })
        .limit(200);

      if (data) {
        // Seed known order IDs on first load so we don't alert for existing orders
        if (!initializedRef.current) {
          for (const row of data) {
            knownOrderIds.current.add(row.id);
          }
          initializedRef.current = true;
          console.log('[NEW ORDER WATCH] Initialized with', knownOrderIds.current.size, 'existing orders');
        }

        const pending = (data as DeliveryOrder[]).filter((o) => o.status_entrega === 'aguardando');
        setDeliveryPendingCount(pending.length);
      }
    }

    checkAlerts();
    checkDeliveryPending();

    // Realtime: keep alert badge and delivery pending badge in sync
    const channel = supabase
      .channel('app-nav-badges-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, () => checkAlerts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, (payload) => {
        // Only react to INSERT events
        if (payload.eventType !== 'INSERT') {
          checkDeliveryPending();
          return;
        }

        const newOrder = payload.new as DeliveryOrder;

        // Only alert if this order ID was not seen before
        if (knownOrderIds.current.has(newOrder.id)) {
          checkDeliveryPending();
          return;
        }

        // Mark as known
        knownOrderIds.current.add(newOrder.id);

        console.log('[NEW ORDER WATCH] New delivery order detected', {
          id: newOrder.id,
          numero_pedido: newOrder.numero_pedido,
          cliente: newOrder.cliente_nome,
          timestamp: new Date().toISOString(),
        });

        // Fetch the full order with items for the toast
        supabase
          .from('delivery_orders')
          .select('*, items:delivery_order_items(*)')
          .eq('id', newOrder.id)
          .single()
          .then(({ data: fullOrder }) => {
            if (fullOrder) {
              const order = fullOrder as DeliveryOrder;

              // Play sound
              const played = playNotificationSound(notifSettings);
              console.log('[NEW ORDER ALERT]', {
                order_id: order.id,
                numero_pedido: order.numero_pedido,
                sound_played: played,
                settings: notifSettings,
                timestamp: new Date().toISOString(),
              });

              // Show toast
              setNewOrderToast(order);
            }
          });

        checkDeliveryPending();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_order_items' }, () => checkDeliveryPending())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, notifSettings]);

  function handleSettingsChange(settings: NotificationSettings) {
    setNotifSettings(settings);
    saveSettings(settings);
    console.log('[NOTIFICATION SETTINGS] Updated', settings);
  }

  function navigateToDelivery() {
    setPage('delivery');
  }

  if (isPublicDelivery) {
    return <DeliveryPage />;
  }

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
    <>
      <Layout
        current={page}
        onNavigate={setPage}
        alertCount={alertCount}
        deliveryPendingCount={deliveryPendingCount}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {page === 'dashboard' && <DashboardPage />}
        {page === 'ingredients' && <IngredientsPage />}
        {page === 'pizzas' && <PizzasPage />}
        {page === 'sales' && <SalesPage />}
        {page === 'delivery' && <DeliveryDashboardPage />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'alerts' && <AlertsPage />}
        {page === 'forecast' && <ForecastPage />}
      </Layout>

      <NotificationSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={notifSettings}
        onChange={handleSettingsChange}
      />

      <OrderToast
        order={newOrderToast}
        onDismiss={() => setNewOrderToast(null)}
        onNavigate={navigateToDelivery}
      />
    </>
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
