export type NavIconKey = "tenants" | "lab" | "users" | "reports" | "catalog" | "pos";

export type NavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
  match?: "exact" | "prefix";
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
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
      { href: "/catalog", label: "Catalog", iconKey: "catalog", match: "prefix" },
      { href: "/pos", label: "POS", iconKey: "pos", match: "prefix" },
    ],
  },
];
