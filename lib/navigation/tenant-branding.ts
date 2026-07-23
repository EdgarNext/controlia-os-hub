export type TenantBranding = {
  logoSrc: string;
  logoAlt: string;
};

const tenantBranding: Record<string, TenantBranding> = {
  "expo-cuu": {
    logoSrc: "/branding/tenants/expo-cuu/logo.png",
    logoAlt: "Logotipo institucional",
  },
};

export function getTenantBranding(tenantSlug: string): TenantBranding | null {
  return tenantBranding[tenantSlug.trim().toLowerCase()] ?? null;
}
