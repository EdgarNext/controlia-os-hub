import type {
  RetailPosCashShiftStatus,
  RetailPosDeviceRole,
  RetailPosOrderStatus,
  RetailPosPaymentMethod,
  RetailPosQuantityString,
} from "@/shared/types/retail-pos";

export type RetailPosCategoryFormValues = {
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type RetailPosProductFormValues = {
  category_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  has_variants: boolean;
  is_active: boolean;
};

export type RetailPosProductVariantFormValues = {
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export type RetailPosDeviceSettingsFormValues = {
  device_role: RetailPosDeviceRole;
  printer_name: string | null;
  printer_driver: string | null;
  auto_print_order_ticket: boolean;
  auto_print_payment_ticket: boolean;
  scanner_enabled: boolean;
  is_active: boolean;
};

export type RetailPosOrderSearchFilters = {
  folio?: string;
  status?: RetailPosOrderStatus | "all";
  origin_device_id?: string;
  created_from?: string;
  created_to?: string;
};

export type RetailPosCreateLineDraft = {
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  quantity: RetailPosQuantityString;
  unit_price_cents: number;
  discount_cents: number;
};

export type RetailPosPaymentDraft = {
  payment_method: RetailPosPaymentMethod;
  amount_cents: number;
  received_amount_cents: number | null;
  card_reference: string | null;
};

export type RetailPosCashShiftCloseFormValues = {
  expected_cash_cents: number;
  declared_cash_cents: number;
  status: Extract<RetailPosCashShiftStatus, "closed" | "canceled">;
};
