"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PasswordResetState = {
  error: string | null;
  success: string | null;
};

function getApplicationOrigin(requestHeaders: Headers): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configuredOrigin) return configuredOrigin;

  const forwardedHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!forwardedHost) throw new Error("No se pudo resolver el origen de la aplicación.");

  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProto || (forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${forwardedHost}`;
}

export async function requestPasswordResetAction(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Captura tu email.", success: null };

  try {
    const origin = getApplicationOrigin(await headers());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    });

    if (error) return { error: error.message, success: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo solicitar el restablecimiento.",
      success: null,
    };
  }

  return {
    error: null,
    success: "Si el correo existe, recibirás instrucciones para restablecer tu contraseña.",
  };
}

export async function updatePasswordAction(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres.", success: null };
  }
  if (password !== confirmation) {
    return { error: "Las contraseñas no coinciden.", success: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message, success: null };

  redirect("/auth/login?reset=success");
}
