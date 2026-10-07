/*
# PizzaStockAI — Database Schema

## Overview
Complete schema for a pizzeria management system: ingredients/inventory, pizza menu with recipes, sales, and user profiles with role-based access (administrador, gerente, atendente). All authenticated staff share the same pizzeria data.

## New Tables

1. **profiles** — extends Supabase auth.users with staff info
   - `id` (uuid, PK, FK to auth.users)
   - `nome` (text, staff member's display name)
   - `perfil` (text, role: 'administrador' | 'gerente' | 'atendente')
   - `created_at` (timestamptz)

2. **ingredients** — inventory items
   - `id` (uuid, PK)
   - `nome` (text, unique)
   - `estoque` (numeric, current stock quantity)
   - `unidade` (text, unit: 'kg', 'un', 'L', etc.)
   - `estoque_minimo` (numeric, minimum threshold for alerts)
   - `custo_unitario` (numeric, cost per unit in BRL)
   - `data_validade` (timestamptz, expiry date)
   - `created_at` (timestamptz)

3. **pizzas** — menu items
   - `id` (uuid, PK)
   - `nome` (text, unique)
   - `preco` (numeric, selling price in BRL)
   - `ativo` (boolean, default true — soft delete / menu visibility)
   - `created_at` (timestamptz)

4. **recipe_items** — recipe junction (pizza ↔ ingredient with quantity)
   - `id` (uuid, PK)
   - `pizza_id` (uuid, FK to pizzas ON DELETE CASCADE)
   - `ingrediente_id` (uuid, FK to ingredients ON DELETE CASCADE)
   - `quantidade` (numeric, amount per single pizza)

5. **sales** — sales records
   - `id` (uuid, PK)
   - `pizza_id` (uuid, FK to pizzas)
   - `quantidade` (integer, number of pizzas sold)
   - `valor_total` (numeric, total sale price)
   - `custo_total` (numeric, total ingredient cost)
   - `criada_em` (timestamptz, sale timestamp)

## Security
- RLS enabled on all tables.
- All tables are shared among authenticated staff (single pizzeria), so policies use `TO authenticated USING (true)` — any signed-in user can read/write. This is intentional shared data, not a per-user ownership model.
- A SECURITY DEFINER function `register_sale` handles atomic sale registration with stock decrement and expiry validation.

## Functions
- `register_sale(p_pizza_id uuid, p_quantidade integer)` — validates stock availability and ingredient expiry, decrements stock, inserts sale record, returns the sale row. SECURITY DEFINER so it can update ingredients atomically.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  perfil text NOT NULL DEFAULT 'atendente' CHECK (perfil IN ('administrador', 'gerente', 'atendente')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated"
ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self"
ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self"
ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- INGREDIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  estoque numeric(12,3) NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'kg',
  estoque_minimo numeric(12,3) NOT NULL DEFAULT 0,
  custo_unitario numeric(10,2) NOT NULL DEFAULT 0,
  data_validade timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredients_select" ON ingredients;
CREATE POLICY "ingredients_select"
ON ingredients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ingredients_insert" ON ingredients;
CREATE POLICY "ingredients_insert"
ON ingredients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ingredients_update" ON ingredients;
CREATE POLICY "ingredients_update"
ON ingredients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ingredients_delete" ON ingredients;
CREATE POLICY "ingredients_delete"
ON ingredients FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PIZZAS
-- ============================================================
CREATE TABLE IF NOT EXISTS pizzas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pizzas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pizzas_select" ON pizzas;
CREATE POLICY "pizzas_select"
ON pizzas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pizzas_insert" ON pizzas;
CREATE POLICY "pizzas_insert"
ON pizzas FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pizzas_update" ON pizzas;
CREATE POLICY "pizzas_update"
ON pizzas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pizzas_delete" ON pizzas;
CREATE POLICY "pizzas_delete"
ON pizzas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- RECIPE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pizza_id uuid NOT NULL REFERENCES pizzas(id) ON DELETE CASCADE,
  ingrediente_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantidade numeric(12,3) NOT NULL DEFAULT 0
);

ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_items_select" ON recipe_items;
CREATE POLICY "recipe_items_select"
ON recipe_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recipe_items_insert" ON recipe_items;
CREATE POLICY "recipe_items_insert"
ON recipe_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "recipe_items_update" ON recipe_items;
CREATE POLICY "recipe_items_update"
ON recipe_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "recipe_items_delete" ON recipe_items;
CREATE POLICY "recipe_items_delete"
ON recipe_items FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pizza_id uuid NOT NULL REFERENCES pizzas(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1,
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  custo_total numeric(10,2) NOT NULL DEFAULT 0,
  criada_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_criada_em ON sales(criada_em);
CREATE INDEX IF NOT EXISTS idx_sales_pizza_id ON sales(pizza_id);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select"
ON sales FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert"
ON sales FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sales_delete" ON sales;
CREATE POLICY "sales_delete"
ON sales FOR DELETE TO authenticated USING (true);

-- ============================================================
-- REGISTER_SALE function (SECURITY DEFINER)
-- Atomically validates stock + expiry, decrements ingredients, inserts sale
-- ============================================================
CREATE OR REPLACE FUNCTION register_sale(p_pizza_id uuid, p_quantidade integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pizza RECORD;
  v_ri RECORD;
  v_ing RECORD;
  v_needed numeric;
  v_cost numeric := 0;
  v_total numeric;
  v_sale_id uuid;
  v_expired text;
BEGIN
  -- Validate pizza exists and is active
  SELECT id, preco INTO v_pizza FROM pizzas WHERE id = p_pizza_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Pizza não encontrada ou inativa');
  END IF;

  IF p_quantidade <= 0 THEN
    RETURN json_build_object('error', 'Quantidade deve ser maior que zero');
  END IF;

  -- Check stock availability and expiry for all recipe items
  v_expired := '';
  FOR v_ri IN
    SELECT ri.ingrediente_id, ri.quantidade, i.nome AS ing_nome, i.estoque, i.data_validade, i.custo_unitario
    FROM recipe_items ri
    JOIN ingredients i ON i.id = ri.ingrediente_id
    WHERE ri.pizza_id = p_pizza_id
  LOOP
    v_needed := v_ri.quantidade * p_quantidade;
    IF v_ri.estoque < v_needed THEN
      RETURN json_build_object('error', 'Estoque insuficiente para: ' || v_ri.ing_nome);
    END IF;
    IF v_ri.data_validade IS NOT NULL AND v_ri.data_validade < now() THEN
      v_expired := v_expired || v_ri.ing_nome || ', ';
    END IF;
    v_cost := v_cost + (v_ri.quantidade * v_ri.custo_unitario * p_quantidade);
  END LOOP;

  IF length(v_expired) > 0 THEN
    RETURN json_build_object('error', 'Ingredientes vencidos: ' || trim(trailing ', ' from v_expired));
  END IF;

  -- Decrement stock
  FOR v_ri IN
    SELECT ingrediente_id, quantidade FROM recipe_items WHERE pizza_id = p_pizza_id
  LOOP
    UPDATE ingredients
    SET estoque = estoque - (v_ri.quantidade * p_quantidade)
    WHERE id = v_ri.ingrediente_id;
  END LOOP;

  v_total := round(v_pizza.preco * p_quantidade, 2);

  INSERT INTO sales (pizza_id, quantidade, valor_total, custo_total)
  VALUES (p_pizza_id, p_quantidade, v_total, round(v_cost, 2))
  RETURNING id INTO v_sale_id;

  RETURN json_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'valor_total', v_total,
    'custo_total', round(v_cost, 2)
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION register_sale(uuid, integer) TO authenticated;

-- ============================================================
-- Auto-create profile on signup via trigger
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'atendente')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;