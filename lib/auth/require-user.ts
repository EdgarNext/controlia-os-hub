import { redirect } from "next/navigation";
import { getUserCached } from "@/lib/auth/get-user";
import { perfMark, perfMeasure } from "@/lib/observability/perf";

export async function requireUser() {
  const startMark = perfMark("requireUser");

  try {
    const user = await getUserCached();

    if (!user) {
      redirect("/auth/login");
    }

    return user;
  } finally {
    perfMeasure("requireUser", startMark);
  }
}
