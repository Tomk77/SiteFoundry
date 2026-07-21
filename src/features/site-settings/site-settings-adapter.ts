import type { PersistedSiteRole, SiteSettingsWorkspace } from "@/lib/site-settings";

import type {
  Invitation,
  Member,
  MemberRole,
  SiteLanguage,
  ViewerRole,
} from "./site-settings-model";

const roleLabels: Record<PersistedSiteRole, MemberRole> = {
  owner: "Owner",
  admin: "Administrator",
  publisher: "Publisher",
  editor: "Editor",
  viewer: "Viewer",
};

const persistedRoles: Record<MemberRole, PersistedSiteRole> = {
  Owner: "owner",
  Administrator: "admin",
  Publisher: "publisher",
  Editor: "editor",
  Viewer: "viewer",
};

export function viewerRole(role: PersistedSiteRole): ViewerRole {
  return role === "admin" ? "administrator" : role;
}

export function persistedRole(role: MemberRole) {
  return persistedRoles[role];
}

export function membersFromWorkspace(workspace: SiteSettingsWorkspace): Member[] {
  const languageNames = new Map(
    workspace.languages.map((language) => [language.id, language.name]),
  );
  const branchNames = new Map(workspace.branches.map((branch) => [branch.id, branch.name]));

  return workspace.members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: roleLabels[member.role],
    scope: member.accessScope,
    languages: member.languageIds,
    branches: member.branchIds,
    sections: member.sections,
    accessLabel:
      member.accessScope === "full"
        ? "Full site"
        : member.accessScope === "languages"
          ? member.languageIds.map((id) => languageNames.get(id) ?? "Language").join(" and ")
          : member.branchIds.map((id) => branchNames.get(id) ?? "Page branch").join(", "),
    lastActive: relativeDate(member.lastActiveAt),
    lastActiveExact: member.lastActiveAt
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(member.lastActiveAt),
        )
      : "No recorded activity",
    current: member.current,
  }));
}

export function invitationsFromWorkspace(workspace: SiteSettingsWorkspace): Invitation[] {
  const languageNames = new Map(
    workspace.languages.map((language) => [language.id, language.name]),
  );
  const branchNames = new Map(workspace.branches.map((branch) => [branch.id, branch.name]));

  return workspace.invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: roleLabels[invitation.role] as Exclude<MemberRole, "Owner">,
    access:
      invitation.accessScope === "full"
        ? "Full site"
        : invitation.accessScope === "languages"
          ? invitation.languageIds.map((id) => languageNames.get(id) ?? "Language").join(" and ")
          : invitation.branchIds.map((id) => branchNames.get(id) ?? "Page branch").join(", "),
    invitedBy: invitation.invitedBy,
    sent: relativeDate(invitation.createdAt),
    status:
      invitation.status === "expired"
        ? "Expired"
        : new Date(invitation.expiresAt).getTime() - Date.now() < 2 * 86_400_000
          ? "Expiring soon"
          : "Pending",
    accessScope: invitation.accessScope,
    languageIds: invitation.languageIds,
    branchIds: invitation.branchIds,
    sections: invitation.sections,
  }));
}

export function languagesFromWorkspace(workspace: SiteSettingsWorkspace): SiteLanguage[] {
  const primaryDomain = workspace.domains.find((domain) => domain.isPrimary)?.hostname;
  const fallbackHost = `${workspace.site.slug}.example`;

  return workspace.languages.map((language) => ({
    id: language.id,
    code: language.code.toUpperCase(),
    name: language.name,
    url: `${primaryDomain ?? fallbackHost}/${language.urlPrefix}`,
    pages: language.pageCount,
    default: language.isDefault,
  }));
}

function relativeDate(value: string | null) {
  if (!value) return "never";
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 172_800_000) return "yesterday";

  return `${Math.floor(elapsed / 86_400_000)} days ago`;
}
