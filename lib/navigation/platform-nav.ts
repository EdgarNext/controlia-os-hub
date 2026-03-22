export type NavIconKey =
  | "tenants"
  | "lab"
  | "users"
  | "reports"
  | "catalog"
  | "pos"
  | "devices"
  | "categories"
  | "products";

export type NavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
  match?: "exact" | "prefix";
  accentToken?: string;
  children?: Array<{
    href: string;
    label: string;
    match?: "exact" | "prefix";
  }>;
};

export type NavDomain = {
  key: string;
  label: string;
  accentToken: string;
  items: NavItem[];
};

export type NavSection = {
  id: string;
  label: string;
  items?: NavItem[];
  domains?: NavDomain[];
};

export const platformNav: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { href: "/tenants", label: "Tenants", iconKey: "tenants", match: "prefix" },
      { href: "/lab", label: "Lab", iconKey: "lab", match: "prefix" },
      { href: "/users", label: "Users", iconKey: "users", match: "prefix" },
      { href: "/reports", label: "Reports", iconKey: "reports", match: "prefix" },
      { href: "/catalog", label: "Modulos", iconKey: "catalog", match: "prefix" },
      { href: "/pos", label: "POS", iconKey: "pos", match: "prefix" },
    ],
  },
];
