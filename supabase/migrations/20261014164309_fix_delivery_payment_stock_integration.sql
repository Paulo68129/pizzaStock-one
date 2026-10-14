/*
# Delivery Module: Payment Integration, Stock Control, and Robustness Fixes

## Overview
This migration fixes the core issues blocking delivery order completion and adds complete payment + stock integration:

1. Adds payment fields to delivery_orders (forma_pagamento, status_pagamento, pago)
2. Adds 'recebido' to the status_entrega CHECK constraint (order received/confirmed)
3. Rewrites create_delivery_order to:
   - Accept payment parameters
   - Decrement ingredient stock for each ordered pizza (using recipe_items)
   - Insert sales records for each pizza item (linking to delivery order)
   - Return detailed error info with item-level context
   - Validate all inputs more thoroughly

## Modified Tables

### delivery_orders
- `forma_pagamento` (text, nullable) — payment method: 'dinheiro', 'cartao', 'pix'
- `status_pagamento` (text, default 'pendente') — payment status: 'pendente', 'pago'
- `pago` (boolean, default false) — denormalized quick-check flag
- status_entrega CHECK now includes 'recebido' (order received/confirmed by staff)

### delivery_order_items
- `sale_id` (uuid, nullable, FK to sales) — links each item to its stock-decrementing sale record

## Functions

### create_delivery_order (rewritten)
New parameters:
- p_forma_pagamento (text) — payment method
- p_status_pagamento (text) — 'pendente' or 'pago'

New behavior:
- For each item with a valid produto_id, checks ingredient stock availability
- If stock is insufficient for any pizza, returns error with the specific ingredient name
- If ingredient is expired, returns error with the specific ingredient name
- Decrements stock for all ingredients in each pizza's recipe
- Inserts a sales record per pizza item (pizza_id, quantidade, valor_total, custo_total)
- Links sale_id back to the delivery_order_items row
- Sets pago=true if status_pagamento='pago'
- Returns order_id, numero_pedido, valor_total, data_pedido, item_count, payment info

## Security
- No RLS policy changes (existing anon+authenticated policies remain)
- SECURITY DEFINER function runs with elevated privileges for atomic stock + sales ops
- Grant EXECUTE updated for new function signature
*/

-- ============================================================
-- Add payment columns to delivery_orders
-- ============================================================
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'pendente';
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false;

-- ============================================================
-- Add 'recebido' to status_entrega CHECK constraint
-- ============================================================
DO $$
BEGIN
  ALTER TABLE delivery_orders DROP CONSTRAINT IF EXISTS delivery_orders_status_entrega_check;
  ALTER TABLE delivery_orders ADD CONSTRAINT delivery_orders_status_entrega_check
    CHECK (status_entrega IN ('aguardando', 'recebido', 'saiu_entrega', 'entregue', 'cancelado'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- Add sale_id to delivery_order_items (links to sales record)
-- ============================================================
ALTER TABLE delivery_order_items ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;

-- ============================================================
-- Rewrite create_delivery_order with stock + sales + payment
-- ============================================================
DROP FUNCTION IF EXISTS create_delivery_order(text, text, text, text, text, text, numeric, json);

CREATE OR REPLACE FUNCTION create_delivery_order(
  p_cliente_nome text,
  p_cliente_telefone text,
  p_cliente_endereco text,
  p_complemento text,
  p_bairro text,
  p_observacao text,
  p_taxa_entrega numeric,
  p_items json,
  p_forma_pagamento text DEFAULT NULL,
  p_status_pagamento text DEFAULT 'pendente'
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
  v_item_count int := 0;
  v_pizza record;
  v_ri record;
  v_needed numeric;
  v_cost numeric;
  v_total_cost numeric := 0;
  v_sale_id uuid;
  v_expired text;
  v_stock_error text;
  v_item_id uuid;
  v_produto_id uuid;
  v_quantidade int;
  v_valor_unitario numeric;
BEGIN
  -- Validate required fields
  IF p_cliente_nome IS NULL OR trim(p_cliente_nome) = '' THEN
    RETURN json_build_object('error', 'Nome do cliente é obrigatório', 'error_code', 'MISSING_NAME');
  END IF;
  IF p_cliente_telefone IS NULL OR trim(p_cliente_telefone) = '' THEN
    RETURN json_build_object('error', 'Telefone é obrigatório', 'error_code', 'MISSING_PHONE');
  END IF;
  IF p_cliente_endereco IS NULL OR trim(p_cliente_endereco) = '' THEN
    RETURN json_build_object('error', 'Endereço é obrigatório', 'error_code', 'MISSING_ADDRESS');
  END IF;
  IF p_items IS NULL OR json_array_length(p_items) = 0 THEN
    RETURN json_build_object('error', 'Pedido deve ter pelo menos um item', 'error_code', 'EMPTY_ITEMS');
  END IF;

  -- Validate payment status
  IF p_status_pagamento IS NULL THEN
    p_status_pagamento := 'pendente';
  END IF;
  IF p_status_pagamento NOT IN ('pendente', 'pago') THEN
    RETURN json_build_object('error', 'Status de pagamento inválido', 'error_code', 'INVALID_PAYMENT_STATUS');
  END IF;

  -- First pass: validate all items, check stock availability and expiry
  v_stock_error := '';
  v_expired := '';

  FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
    v_item_count := v_item_count + 1;
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_quantidade := (v_item->>'quantidade')::int;
    v_valor_unitario := (v_item->>'valor_unitario')::numeric;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RETURN json_build_object('error', 'Quantidade inválida para item: ' || COALESCE(v_item->>'produto_nome', 'desconhecido'), 'error_code', 'INVALID_QTY');
    END IF;

    -- Only check stock if this is a pizza with a recipe (produto_id links to pizzas)
    IF v_produto_id IS NOT NULL THEN
      -- Check that the pizza exists
      SELECT id, preco, ativo INTO v_pizza FROM pizzas WHERE id = v_produto_id;
      IF NOT FOUND THEN
        RETURN json_build_object('error', 'Produto não encontrado: ' || (v_item->>'produto_nome'), 'error_code', 'PRODUCT_NOT_FOUND');
      END IF;

      -- Check stock availability for all recipe ingredients
      FOR v_ri IN
        SELECT ri.ingrediente_id, ri.quantidade, i.nome AS ing_nome, i.estoque, i.data_validade
        FROM recipe_items ri
        JOIN ingredients i ON i.id = ri.ingrediente_id
        WHERE ri.pizza_id = v_produto_id
      LOOP
        v_needed := v_ri.quantidade * v_quantidade;
        IF v_ri.estoque < v_needed THEN
          v_stock_error := v_stock_error || v_ri.ing_nome || ' (necessário: ' || v_needed || ', disponível: ' || v_ri.estoque || '), ';
        END IF;
        IF v_ri.data_validade IS NOT NULL AND v_ri.data_validade < now() THEN
          v_expired := v_expired || v_ri.ing_nome || ', ';
        END IF;
      END LOOP;
    END IF;

    v_subtotal := v_quantidade * v_valor_unitario;
    v_total := v_total + v_subtotal;
  END LOOP;

  -- If any stock errors, return them all at once
  IF length(v_stock_error) > 0 THEN
    RETURN json_build_object(
      'error', 'Estoque insuficiente: ' || trim(trailing ', ' from v_stock_error),
      'error_code', 'INSUFFICIENT_STOCK'
    );
  END IF;

  IF length(v_expired) > 0 THEN
    RETURN json_build_object(
      'error', 'Ingredientes vencidos: ' || trim(trailing ', ' from v_expired),
      'error_code', 'EXPIRED_INGREDIENTS'
    );
  END IF;

  v_total := v_total + COALESCE(p_taxa_entrega, 0);

  -- Create the order
  INSERT INTO delivery_orders (
    cliente_nome, cliente_telefone, cliente_endereco,
    complemento, bairro, observacao, taxa_entrega, valor_total,
    forma_pagamento, status_pagamento, pago
  ) VALUES (
    p_cliente_nome, p_cliente_telefone, p_cliente_endereco,
    p_complemento, p_bairro, p_observacao, COALESCE(p_taxa_entrega, 0), round(v_total, 2),
    p_forma_pagamento, p_status_pagamento, (p_status_pagamento = 'pago')
  )
  RETURNING id, numero_pedido, valor_total, data_pedido INTO v_order;

  -- Second pass: insert items, decrement stock, register sales
  FOR v_item IN SELECT * FROM json_array_elements(p_items) LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_quantidade := (v_item->>'quantidade')::int;
    v_valor_unitario := (v_item->>'valor_unitario')::numeric;
    v_subtotal := v_quantidade * v_valor_unitario;
    v_sale_id := NULL;
    v_cost := 0;

    -- If this item is a pizza with a recipe, decrement stock and register sale
    IF v_produto_id IS NOT NULL THEN
      -- Calculate cost from recipe
      SELECT COALESCE(SUM(ri.quantidade * i.custo_unitario * v_quantidade), 0) INTO v_cost
      FROM recipe_items ri
      JOIN ingredients i ON i.id = ri.ingrediente_id
      WHERE ri.pizza_id = v_produto_id;

      -- Decrement stock for all ingredients
      FOR v_ri IN
        SELECT ingrediente_id, quantidade FROM recipe_items WHERE pizza_id = v_produto_id
      LOOP
        UPDATE ingredients
        SET estoque = estoque - (v_ri.quantidade * v_quantidade)
        WHERE id = v_ri.ingrediente_id;
      END LOOP;

      -- Insert sales record
      INSERT INTO sales (pizza_id, quantidade, valor_total, custo_total)
      VALUES (v_produto_id, v_quantidade, round(v_subtotal, 2), round(v_cost, 2))
      RETURNING id INTO v_sale_id;

      v_total_cost := v_total_cost + v_cost;
    END IF;

    -- Insert delivery_order_item with sale_id link
    INSERT INTO delivery_order_items (
      pedido_id, produto_id, produto_nome, descricao, quantidade, valor_unitario, subtotal, sale_id
    ) VALUES (
      v_order.id,
      v_produto_id,
      v_item->>'produto_nome',
      v_item->>'descricao',
      v_quantidade,
      v_valor_unitario,
      round(v_subtotal, 2),
      v_sale_id
    )
    RETURNING id INTO v_item_id;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order.id,
    'numero_pedido', v_order.numero_pedido,
    'valor_total', v_order.valor_total,
    'data_pedido', v_order.data_pedido,
    'item_count', v_item_count,
    'forma_pagamento', p_forma_pagamento,
    'status_pagamento', p_status_pagamento,
    'custo_total', round(v_total_cost, 2)
  );
END;
$$;

-- Grant execute on the new function signature
GRANT EXECUTE ON FUNCTION create_delivery_order(text, text, text, text, text, text, numeric, json, text, text) TO anon, authenticated;
