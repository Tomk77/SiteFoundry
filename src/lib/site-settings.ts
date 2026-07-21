import type { Json } from "./database.types";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export type PersistedSiteRole = "owner" | "admin" | "publisher" | "editor" | "viewer";
export type PersistedAccessScope = "full" | "languages" | "branches";

export interface SiteSettingsWorkspace {
  viewerRole: PersistedSiteRole;
  site: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    timezone: string;
    iconUrl: string | null;
    previewUrl: string;
  };
  languages: Array<{
    id: string;
    code: string;
    name: string;
    isDefault: boolean;
    position: number;
    urlPrefix: string;
    pageCount: number;
  }>;
  branches: Array<{
    id: string;
    name: string;
    languageId: string;
    languageName: string;
  }>;
  members: Array<{
    id: string;
    name: string;
    email: string;
    role: PersistedSiteRole;
    accessScope: PersistedAccessScope;
    languageIds: string[];
    branchIds: string[];
    sections: string[];
    lastActiveAt: string | null;
    current: boolean;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: Exclude<PersistedSiteRole, "owner">;
    accessScope: PersistedAccessScope;
    languageIds: string[];
    branchIds: string[];
    sections: string[];
    status: "pending" | "expired";
    invitedBy: string;
    createdAt: string;
    expiresAt: string;
  }>;
  domains: Array<{
    id: string;
    hostname: string;
    isPrimary: boolean;
    status: "verified" | "verification_pending" | "misconfigured" | "not_connected";
    verificationMessage: string;
  }>;
}

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();

  return client;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function siteRole(value: unknown): PersistedSiteRole {
  return value === "owner" || value === "admin" || value === "publisher" || value === "viewer"
    ? value
    : "editor";
}

function memberRole(value: unknown): Exclude<PersistedSiteRole, "owner"> {
  const role = siteRole(value);

  return role === "owner" ? "editor" : role;
}

function accessScope(value: unknown): PersistedAccessScope {
  return value === "languages" || value === "branches" ? value : "full";
}

function normalizeWorkspace(value: Json): SiteSettingsWorkspace | null {
  if (!value) return null;
  const payload = record(value);
  const site = record(payload.site);
  const siteId = text(site.id);
  if (!siteId) throw new Error("The database returned an invalid Site Settings workspace.");

  return {
    viewerRole: siteRole(payload.viewerRole),
    site: {
      id: siteId,
      name: text(site.name, "Website"),
      slug: text(site.slug),
      ownerId: text(site.ownerId),
      timezone: text(site.timezone, "Europe/Amsterdam"),
      iconUrl: typeof site.iconUrl === "string" ? site.iconUrl : null,
      previewUrl: text(site.previewUrl),
    },
    languages: list(payload.languages).map((language, index) => ({
      id: text(language.id),
      code: text(language.code),
      name: text(language.name),
      isDefault: Boolean(language.isDefault),
      position: Number(language.position) || index,
      urlPrefix: text(language.urlPrefix),
      pageCount: Number(language.pageCount) || 0,
    })),
    branches: list(payload.branches).map((branch) => ({
      id: text(branch.id),
      name: text(branch.name),
      languageId: text(branch.languageId),
      languageName: text(branch.languageName),
    })),
    members: list(payload.members).map((member) => ({
      id: text(member.id),
      name: text(member.name, "Member"),
      email: text(member.email),
      role: siteRole(member.role),
      accessScope: accessScope(member.accessScope),
      languageIds: stringList(member.languageIds),
      branchIds: stringList(member.branchIds),
      sections: stringList(member.sections),
      lastActiveAt: typeof member.lastActiveAt === "string" ? member.lastActiveAt : null,
      current: Boolean(member.current),
    })),
    invitations: list(payload.invitations).map((invitation) => ({
      id: text(invitation.id),
      email: text(invitation.email),
      role: memberRole(invitation.role),
      accessScope: accessScope(invitation.accessScope),
      languageIds: stringList(invitation.languageIds),
      branchIds: stringList(invitation.branchIds),
      sections: stringList(invitation.sections),
      status: invitation.status === "expired" ? "expired" : "pending",
      invitedBy: text(invitation.invitedBy, "Site administrator"),
      createdAt: text(invitation.createdAt),
      expiresAt: text(invitation.expiresAt),
    })),
    domains: list(payload.domains).map((domain) => ({
      id: text(domain.id),
      hostname: text(domain.hostname),
      isPrimary: Boolean(domain.isPrimary),
      status:
        domain.status === "verified" ||
        domain.status === "misconfigured" ||
        domain.status === "not_connected"
          ? domain.status
          : "verification_pending",
      verificationMessage: text(domain.verificationMessage),
    })),
  };
}

export async function loadSiteSettingsWorkspace(siteId?: string) {
  const { data, error } = await requireClient().rpc("get_site_settings_workspace", {
    target_site_id: siteId ?? null,
  });
  if (error) throw error;

  return normalizeWorkspace(data);
}

export async function saveSiteGeneralSettings(
  siteId: string,
  input: { name: string; slug: string; timezone: string; previewUrl: string },
) {
  const { error } = await requireClient()
    .from("sites")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim(),
      timezone: input.timezone,
      preview_url: input.previewUrl.trim(),
    })
    .eq("id", siteId);
  if (error) throw error;
}

export async function createSiteInvitation(
  siteId: string,
  invitation: {
    email: string;
    role: Exclude<PersistedSiteRole, "owner">;
    accessScope: PersistedAccessScope;
    languageIds: string[];
    branchIds: string[];
    sections: string[];
  },
) {
  const { error } = await requireClient().from("site_invitations").insert({
    site_id: siteId,
    email: invitation.email.trim().toLowerCase(),
    role: invitation.role,
    access_scope: invitation.accessScope,
    language_ids: invitation.languageIds,
    branch_ids: invitation.branchIds,
    sections: invitation.sections,
  });
  if (error) throw error;
}

export async function revokeSiteInvitation(invitationId: string) {
  const { error } = await requireClient()
    .from("site_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);
  if (error) throw error;
}

export async function saveSiteMemberAccess(
  siteId: string,
  member: {
    id: string;
    role: PersistedSiteRole;
    accessScope: PersistedAccessScope;
    languageIds: string[];
    branchIds: string[];
    sections: string[];
  },
) {
  const { error } = await requireClient().rpc("update_site_member_access", {
    target_site_id: siteId,
    target_user_id: member.id,
    target_role: member.role,
    target_access_scope: member.accessScope,
    target_language_ids: member.languageIds,
    target_branch_ids: member.branchIds,
    target_sections: member.sections,
  });
  if (error) throw error;
}

export async function addSiteLanguage(
  siteId: string,
  language: { code: string; name: string; urlPrefix: string; position: number },
) {
  const { error } = await requireClient().from("site_languages").insert({
    site_id: siteId,
    code: language.code.toLowerCase(),
    name: language.name,
    url_prefix: language.urlPrefix,
    position: language.position,
  });
  if (error) throw error;
}

export async function setDefaultSiteLanguage(siteId: string, languageId: string) {
  const { error } = await requireClient().rpc("set_default_site_language", {
    target_site_id: siteId,
    target_language_id: languageId,
  });
  if (error) throw error;
}

export async function deleteSiteLanguage(languageId: string) {
  const { error } = await requireClient().from("site_languages").delete().eq("id", languageId);
  if (error) throw error;
}

export async function addSiteDomain(siteId: string, hostname: string) {
  const { error } = await requireClient().from("site_domains").insert({
    site_id: siteId,
    hostname: hostname.trim().toLowerCase(),
  });
  if (error) throw error;
}

export async function requestDomainVerification(domainId: string) {
  const { error } = await requireClient()
    .from("site_domains")
    .update({ status: "verification_pending", verification_message: "Verification requested" })
    .eq("id", domainId);
  if (error) throw error;
}

export async function setPrimarySiteDomain(siteId: string, domainId: string) {
  const { error } = await requireClient().rpc("set_primary_site_domain", {
    target_site_id: siteId,
    target_domain_id: domainId,
  });
  if (error) throw error;
}

export async function requestSiteExport(siteId: string) {
  const { error } = await requireClient().from("site_export_requests").insert({ site_id: siteId });
  if (error) throw error;
}

export async function transferSiteOwnership(siteId: string, userId: string) {
  const { error } = await requireClient().rpc("transfer_site_ownership", {
    target_site_id: siteId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function deleteSite(siteId: string) {
  const { error } = await requireClient().from("sites").delete().eq("id", siteId);
  if (error) throw error;
}
