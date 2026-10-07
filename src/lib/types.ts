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
