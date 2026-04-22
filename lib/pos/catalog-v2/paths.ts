export function getCatalogV2RootPath(tenantSlug: string): string {
  return `/${tenantSlug}/pos/catalog-v2`;
}

export function getCatalogV2CategoriesPath(tenantSlug: string): string {
  return `${getCatalogV2RootPath(tenantSlug)}/categories`;
}

export function getCatalogV2CategoryNewPath(tenantSlug: string): string {
  return `${getCatalogV2CategoriesPath(tenantSlug)}/new`;
}

export function getCatalogV2CategoryEditPath(tenantSlug: string, categoryId: string): string {
  return `${getCatalogV2CategoriesPath(tenantSlug)}/${categoryId}/edit`;
}

export function getCatalogV2ProductsPath(tenantSlug: string): string {
  return `${getCatalogV2RootPath(tenantSlug)}/products`;
}

export function getCatalogV2ProductNewPath(tenantSlug: string): string {
  return `${getCatalogV2ProductsPath(tenantSlug)}/new`;
}

export function getCatalogV2ModifiersPath(
  tenantSlug: string,
  query?: Record<string, string | null>,
  section?: string,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const qs = searchParams.toString();
  return `${getCatalogV2RootPath(tenantSlug)}/modifiers${qs ? `?${qs}` : ""}${section ? `#${section}` : ""}`;
}

export function getCatalogV2ProductDetailPath(
  tenantSlug: string,
  productId: string,
  section?: string,
  query?: Record<string, string | null>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const qs = searchParams.toString();
  return `${getCatalogV2ProductsPath(tenantSlug)}/${productId}${qs ? `?${qs}` : ""}${section ? `#${section}` : ""}`;
}
