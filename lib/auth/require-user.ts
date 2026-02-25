import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";

export async function requireUser() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user;
}
