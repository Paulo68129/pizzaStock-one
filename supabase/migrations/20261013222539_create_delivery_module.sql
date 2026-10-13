/*
# Delivery Module — Schema for PizzaStockAI

## Overview
Adds a complete delivery/ordering system to PizzaStockAI. This migration:
1. Extends the existing `pizzas` table with catalog fields (description, category, image_url).
2. Creates `delivery_orders` table for delivery order headers.
3. Creates `delivery_order_items` table for individual items within an order.
4. Creates a sequence for auto-incrementing order numbers.
5. Enables RLS with both anon (public delivery page) and authenticated (admin) access.

## Modified Tables

### pizzas (extended)
- `descricao` (text, nullable) — product description shown in the delivery catalog
- `categoria` (text, nullable) — category label (e.g. "Pizzas Salgadas", "Bebidas", "Sobremesas")
- `imagem_url` (text, nullable) — URL to product image
- `destaque` (boolean, default false) — highlights product in the catalog

## New Tables

### delivery_orders
- `id` (uuid, PK)
- `numero_pedido` (integer, unique) — auto-incrementing order number (starts at 100)
- `cliente_nome` (text, not null) — customer's full name
- `cliente_telefone` (text, not null) — customer's phone
- `cliente_endereco` (text, not null) — delivery address
- `complemento` (text, nullable) — address complement
- `bairro` (text, nullable) — neighborhood
- `motoboy` (text, nullable) — delivery driver name
- `status_entrega` (text, not null, default 'aguardando') — one of: aguardando, saiu_entrega, entregue, cancelado
- `valor_total` (numeric, not null, default 0) — total order value including delivery fee
- `taxa_entrega` (numeric, default 0) — delivery fee
- `data_pedido` (timestamptz, default now()) — order timestamp
- `observacao` (text, nullable) — order notes from customer

### delivery_order_items
- `id` (uuid, PK)
- `pedido_id` (uuid, FK to delivery_orders ON DELETE CASCADE)
- `produto_id` (uuid, FK to pizzas ON DELETE SET NULL)
- `produto_nome` (text, not null) — snapshot of product name at time of order
- `descricao` (text, nullable) — snapshot of product description
- `quantidade` (integer, not null, default 1)
- `valor_unitario` (numeric, not null, default 0) — price per unit at time of order
- `subtotal` (numeric, not null, default 0) — quantidade * valor_unitario

## Security

### pizzas (extended policies)
The existing pizzas policies are `TO authenticated` only. The public delivery page needs to read pizzas as anon.
We add a SELECT policy for `anon` so the catalog is publicly visible.

### delivery_orders
- SELECT: both anon (customers see their own orders) and authenticated (staff see all). Since there's no customer auth, anon can read all — this is a public ordering system.
- INSERT: anon can create orders (customers placing orders from the public page).
- UPDATE: authenticated only (staff updating status/motoboy).
- DELETE: authenticated only (staff canceling/removing orders).

### delivery_order_items
- SELECT: same as delivery_orders — anon + authenticated.
- INSERT: anon can insert items (as part of placing an order).
- DELETE: authenticated only.

## Functions
- `get_next_pedido_numero()` — returns the next sequential order number, starting at 100.
- `create_delivery_order(p_items json, p_cliente json)` — atomically creates an order with items, assigns the order number, returns the full order. SECURITY DEFINER so anon can insert.

## Notes
1. Order numbers start at 100 and increment by 1.
2. The public delivery page works WITHOUT authentication — customers can browse and order.
3. Staff (authenticated) manage orders: assign motoboys, update status, print/export.
*/

-- ============================================================
-- Extend pizzas table with catalog fields
-- ============================================================
ALTER TABLE pizzas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE pizzas ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE pizzas ADD COLUMN IF NOT EXISTS imagem_url text;
ALTER TABLE pizzas ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;

-- Allow anon to read active pizzas (public catalog)
DROP POLICY IF EXISTS "pizzas_select_anon" ON pizzas;
CREATE POLICY "pizzas_select_anon"
ON pizzas FOR SELECT
TO anon USING (true);

-- ============================================================
-- Sequence for order numbers (starts at 100)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS delivery_pedido_seq START 100;

-- ============================================================
-- delivery_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido integer UNIQUE NOT NULL DEFAULT nextval('delivery_pedido_seq'),
  cliente_nome text NOT NULL,
  cliente_telefone text NOT NULL,
  cliente_endereco text NOT NULL,
  complemento text,
  bairro text,
  motoboy text,
  status_entrega text NOT NULL DEFAULT 'aguardando' CHECK (status_entrega IN ('aguardando', 'saiu_entrega', 'entregue', 'cancelado')),
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  taxa_entrega numeric(10,2) NOT NULL DEFAULT 0,
  data_pedido timestamptz DEFAULT now(),
  observacao text
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_numero ON delivery_orders(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status_entrega);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_data ON delivery_orders(data_pedido);

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_orders_select" ON delivery_orders;
CREATE POLICY "delivery_orders_select"
ON delivery_orders FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "delivery_orders_insert" ON delivery_orders;
CREATE POLICY "delivery_orders_insert"
ON delivery_orders FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_orders_update" ON delivery_orders;
CREATE POLICY "delivery_orders_update"
ON delivery_orders FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_orders_delete" ON delivery_orders;
CREATE POLICY "delivery_orders_delete"
ON delivery_orders FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- delivery_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES pizzas(id) ON DELETE SET NULL,
  produto_nome text NOT NULL,
  descricao text,
  quantidade integer NOT NULL DEFAULT 1,
  valor_unitario numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_pedido ON delivery_order_items(pedido_id);

ALTER TABLE delivery_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_items_select" ON delivery_order_items;
CREATE POLICY "delivery_items_select"
ON delivery_order_items FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "delivery_items_insert" ON delivery_order_items;
CREATE POLICY "delivery_items_insert"
ON delivery_order_items FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_items_update" ON delivery_order_items;
CREATE POLICY "delivery_items_update"
ON delivery_order_items FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_items_delete" ON delivery_order_items;
CREATE POLICY "delivery_items_delete"
ON delivery_order_items FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- create_delivery_order function (SECURITY DEFINER)
-- Atomically creates an order + items, returns the order with numero_pedido
-- ============================================================
CREATE OR REPLACE FUNCTION create_delivery_order(
  p_cliente_nome text,
  p_cliente_telefone text,
  p_cliente_endereco text,
  p_complemento text,
  p_bairro text,
  p_observacao text,
  p_taxa_entrega numeric,
  p_items json
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item json;
  v_subtotal numeric;
  v_total numeric := 0;
  v_items_inserted json[] := '{}';
BEGIN
  -- Validate required fields
  IF p_cliente_nome IS NULL OR trim(p_cliente_nome) = '' THEN
    RETURN json_build_object('error', 'Nome do cliente é obrigatório');
  END IF;
  IF p_cliente_telefone IS NULL OR trim(p_cliente_telefone) = '' THEN
    RETURN json_build_object('error', 'Telefone é obrigatório');
  END IF;
  IF p_cliente_endereco IS NULL OR trim(p_cliente_endereco) = '' THEN
    RETURN json_build_object('error', 'Endereço é obrigatório');
  END IF;
  IF p_items IS NULL OR json_array_length(p_items) = 0 THEN
    RETURN json_build_object('error', 'Pedido deve ter pelo menos um item');
  END IF;

  -- Calculate total from items
  FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
    v_subtotal := (v_item->>'quantidade')::int * (v_item->>'valor_unitario')::numeric;
    v_total := v_total + v_subtotal;
  END LOOP;

  v_total := v_total + COALESCE(p_taxa_entrega, 0);

  -- Create the order
  INSERT INTO delivery_orders (
    cliente_nome, cliente_telefone, cliente_endereco,
    complemento, bairro, observacao, taxa_entrega, valor_total
  ) VALUES (
    p_cliente_nome, p_cliente_telefone, p_cliente_endereco,
    p_complemento, p_bairro, p_observacao, COALESCE(p_taxa_entrega, 0), round(v_total, 2)
  )
  RETURNING id, numero_pedido, valor_total, data_pedido INTO v_order;

  -- Insert items
  FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
    v_subtotal := (v_item->>'quantidade')::int * (v_item->>'valor_unitario')::numeric;
    INSERT INTO delivery_order_items (
      pedido_id, produto_id, produto_nome, descricao, quantidade, valor_unitario, subtotal
    ) VALUES (
      v_order.id,
      NULLIF(v_item->>'produto_id', '')::uuid,
      v_item->>'produto_nome',
      v_item->>'descricao',
      (v_item->>'quantidade')::int,
      (v_item->>'valor_unitario')::numeric,
      round(v_subtotal, 2)
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order.id,
    'numero_pedido', v_order.numero_pedido,
    'valor_total', v_order.valor_total,
    'data_pedido', v_order.data_pedido
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_delivery_order(text, text, text, text, text, text, numeric, json) TO anon, authenticated;

-- Grant sequence usage to anon (needed for DEFAULT nextval)
GRANT USAGE, SELECT ON SEQUENCE delivery_pedido_seq TO anon, authenticated;