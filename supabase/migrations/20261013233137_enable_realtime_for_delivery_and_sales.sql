/*
# Enable Supabase Realtime for delivery, pizzas, sales, and ingredients

1. Purpose
   Adds the core business tables to the `supabase_realtime` publication so
   the frontend can subscribe to INSERT/UPDATE/DELETE events via Supabase
   Realtime channels. This powers live order tracking, instant dashboard
   metric updates, and automatic catalog refresh on the public delivery page.

2. Tables added to realtime publication
   - `delivery_orders` — new orders and status/motoboy changes stream to the
     delivery dashboard, sales page, and the pending-count badge in the nav.
   - `delivery_order_items` — item-level changes (rare, but kept for completeness).
   - `pizzas` — price/availability/description changes reflect instantly on the
     public delivery catalog without a page reload.
   - `sales` — presential sales appear in the sales table immediately.
   - `ingredients` — stock changes update the alert badge in real time.

3. Security
   No RLS or policy changes — Realtime respects existing RLS policies.
   Subscribers using the anon key only receive rows they are allowed to see.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE delivery_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE pizzas;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
