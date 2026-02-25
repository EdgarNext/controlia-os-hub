export type TenantStatus = "active" | "inactive" | "archived";
export type TenantRole = "admin" | "operator" | "viewer";

export type TenantRecord = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  created_at: string;
  created_by: string | null;
  updated_at: string;
};

export type TenantBrandingRecord = {
  tenant_id: string;
  display_name: string | null;
  logo_url: string | null;
  theme: Record<string, unknown>;
  updated_at: string;
};

export type TenantMembershipRecord = {
  membership_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: TenantRole;
  created_at: string;
};

export type UserLookupResult = {
  user_id: string;
  email: string;
  display_name: string | null;
};

export type TenantModuleRecord = {
  id: string;
  module_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  module: {
    name: string;
    description: string | null;
    status: "active" | "deprecated" | "planned";
  } | null;
};
