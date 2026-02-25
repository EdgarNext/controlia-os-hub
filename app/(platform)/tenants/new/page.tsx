import { redirect } from "next/navigation";

export default function NewTenantPage() {
  redirect("/tenants?new=1");
}
