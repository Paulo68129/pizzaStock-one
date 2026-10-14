export type Perfil = 'administrador' | 'gerente' | 'atendente';

export interface Profile {
  id: string;
  nome: string;
  perfil: Perfil;
  created_at: string;
}

export interface Ingredient {
  id: string;
  nome: string;
  estoque: number;
  unidade: string;
  estoque_minimo: number;
  custo_unitario: number;
  data_validade: string | null;
  created_at: string;
}

export interface Pizza {
  id: string;
  nome: string;
  preco: number;
  ativo: boolean;
  descricao?: string;
  categoria?: string;
  imagem_url?: string;
  destaque?: boolean;
  created_at: string;
}

export interface RecipeItem {
  id: string;
  pizza_id: string;
  ingrediente_id: string;
  quantidade: number;
  ingredient?: Ingredient;
}

export interface Sale {
  id: string;
  pizza_id: string;
  quantidade: number;
  valor_total: number;
  custo_total: number;
  criada_em: string;
  pizza?: Pizza;
}

export interface PizzaWithRecipe extends Pizza {
  recipe_items?: RecipeItem[];
}

export interface RegisterSaleResult {
  error?: string;
  success?: boolean;
  sale_id?: string;
  valor_total?: number;
  custo_total?: number;
}

// ============================================================
// Delivery module types
// ============================================================

export type DeliveryStatus = 'aguardando' | 'recebido' | 'saiu_entrega' | 'entregue' | 'cancelado';

export type PaymentMethod = 'dinheiro' | 'cartao' | 'pix';
export type PaymentStatus = 'pendente' | 'pago';

export interface DeliveryOrderItem {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  descricao: string | null;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

export interface DeliveryOrder {
  id: string;
  numero_pedido: number;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_endereco: string;
  complemento: string | null;
  bairro: string | null;
  motoboy: string | null;
  status_entrega: DeliveryStatus;
  valor_total: number;
  taxa_entrega: number;
  data_pedido: string;
  observacao: string | null;
  forma_pagamento: string | null;
  status_pagamento: PaymentStatus;
  pago: boolean;
  items?: DeliveryOrderItem[];
}

export interface CreateDeliveryOrderResult {
  error?: string;
  error_code?: string;
  success?: boolean;
  order_id?: string;
  numero_pedido?: number;
  valor_total?: number;
  data_pedido?: string;
  item_count?: number;
  forma_pagamento?: string;
  status_pagamento?: string;
  custo_total?: number;
}

export interface CartItem {
  pizza: Pizza;
  quantidade: number;
}
