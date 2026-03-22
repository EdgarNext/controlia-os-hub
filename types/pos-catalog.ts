import type { PosCatalogCategory, PosCatalogItem } from "@/types/pos";

export type PosCatalogCategoryListItem = Pick<
  PosCatalogCategory,
  "id" | "tenant_id" | "name" | "sort_order" | "is_active" | "deleted_at" | "updated_at"
> & {
  created_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

export type PosCatalogCategorySelectItem = Pick<PosCatalogCategory, "id" | "tenant_id" | "name">;

export type PosCatalogCategoryFormValues = {
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type PosCatalogProductListItem = Pick<
  PosCatalogItem,
  | "id"
  | "tenant_id"
  | "category_id"
  | "type"
  | "class"
  | "name"
  | "price_cents"
  | "is_active"
  | "is_sold_out"
  | "is_popular"
  | "image_path"
  | "deleted_at"
  | "updated_at"
> & {
  created_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  category_name?: string | null;
};

export type PosCatalogProductFormValues = {
  name: string;
  category_id: string | null;
  class: "food" | "drink";
  price_cents: number;
  is_active: boolean;
};
