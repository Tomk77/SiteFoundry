import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export type InterfaceMode = "system" | "light" | "dark";

export interface PersonalSettings {
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
  interfaceLanguage: string;
  interfaceMode: InterfaceMode;
}

export const interfaceLanguages = [
  { code: "en", name: "English" },
  { code: "nl", name: "Nederlands" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
] as const;

export function applyInterfaceMode(mode: InterfaceMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("sf-interface-mode", mode);
  document.documentElement.dataset.sfMode = mode;
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.sfTheme = dark ? "dark" : "light";
}

export async function loadPersonalSettings(user: User): Promise<PersonalSettings> {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { data, error } = await client
    .from("profiles")
    .select("first_name, last_name, display_name, full_name, interface_language, interface_mode")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  const metadataName = String(user.user_metadata?.full_name ?? "").trim();
  const fallbackName = metadataName || user.email?.split("@")[0] || "Editor";

  return {
    firstName: data?.first_name ?? fallbackName.split(/\s+/)[0] ?? "",
    lastName: data?.last_name ?? fallbackName.split(/\s+/).slice(1).join(" ") ?? "",
    email: user.email ?? "",
    displayName: data?.display_name ?? data?.full_name ?? fallbackName,
    interfaceLanguage: data?.interface_language ?? "en",
    interfaceMode:
      data?.interface_mode === "light" || data?.interface_mode === "dark"
        ? data.interface_mode
        : "system",
  };
}

export async function savePersonalSettings(user: User, settings: PersonalSettings) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const emailChanged = settings.email.trim().toLowerCase() !== user.email?.toLowerCase();
  if (emailChanged) {
    const { error: emailError } = await client.auth.updateUser({
      email: settings.email.trim().toLowerCase(),
    });
    if (emailError) throw emailError;
  }

  const fullName = [settings.firstName.trim(), settings.lastName.trim()].filter(Boolean).join(" ");
  const { error } = await client
    .from("profiles")
    .update({
      first_name: settings.firstName.trim(),
      last_name: settings.lastName.trim() || null,
      display_name: settings.displayName.trim(),
      full_name: fullName,
      interface_language: settings.interfaceLanguage,
      interface_mode: settings.interfaceMode,
    })
    .eq("id", user.id);
  if (error) throw error;
  const { error: metadataError } = await client.auth.updateUser({
    data: { full_name: settings.displayName.trim() || fullName },
  });
  if (metadataError) throw metadataError;
  applyInterfaceMode(settings.interfaceMode);

  return { emailConfirmationPending: emailChanged };
}

export async function changePassword(input: {
  email: string;
  currentPassword: string;
  newPassword: string;
}) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.currentPassword,
  });
  if (signInError) throw new Error("Your current password is incorrect.");
  const { error } = await client.auth.updateUser({
    password: input.newPassword,
  });
  if (error) throw error;
}

export function usesPasswordAuthentication(user: User) {
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.map(String)
    : [String(user.app_metadata?.provider ?? "")];

  return providers.includes("email");
}
