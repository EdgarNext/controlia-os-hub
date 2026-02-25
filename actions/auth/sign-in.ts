"use server";

import { redirect } from "next/navigation";
import { resolveUserLandingPath } from "@/lib/auth/resolve-landing-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = {
  error: string | null;
};

type Credentials = {
  email: string;
  password: string;
};

function resolveCredentials(input: FormData | Credentials): Credentials {
  if (input instanceof FormData) {
    return {
      email: String(input.get("email") ?? "").trim(),
      password: String(input.get("password") ?? ""),
    };
  }

  return {
    email: input.email.trim(),
    password: input.password,
  };
}

export async function signIn(input: FormData | Credentials): Promise<{ error: string | null }> {
  const credentials = resolveCredentials(input);

  if (!credentials.email || !credentials.password) {
    return { error: "Email y password son obligatorios." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const result = await signIn(formData);

  if (result.error) {
    return result;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "No se pudo resolver la sesión después del login." };
  }

  const landingPath = await resolveUserLandingPath(supabase, user.id);
  redirect(landingPath);
}
