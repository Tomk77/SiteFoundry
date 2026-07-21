export const destinations = [
  { id: "general", label: "General", icon: "ph-sliders-horizontal" },
  { id: "people", label: "People & access", icon: "ph-users-three" },
  { id: "languages", label: "Languages", icon: "ph-translate" },
  { id: "domains", label: "Domains & preview", icon: "ph-globe" },
  { id: "advanced", label: "Advanced", icon: "ph-wrench" },
] as const;

export type SettingsDestination = (typeof destinations)[number]["id"];
export type PeopleTab = "members" | "invitations" | "roles";
export type ViewerRole = "owner" | "administrator" | "publisher" | "editor" | "viewer";
export type MemberRole = "Owner" | "Administrator" | "Publisher" | "Editor" | "Viewer";
export type AccessScope = "full" | "languages" | "branches";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  scope: AccessScope;
  languages: string[];
  branches: string[];
  sections: string[];
  accessLabel?: string;
  lastActive: string;
  lastActiveExact: string;
  current?: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  role: Exclude<MemberRole, "Owner">;
  access: string;
  invitedBy: string;
  sent: string;
  status: "Pending" | "Expiring soon" | "Expired";
  accessScope?: AccessScope;
  languageIds?: string[];
  branchIds?: string[];
  sections?: string[];
};

export type InvitationDraft = {
  email: string;
  role: Exclude<MemberRole, "Owner">;
  accessScope: AccessScope;
  languageIds: string[];
  branchIds: string[];
  sections: string[];
};

export type SiteLanguage = {
  id?: string;
  code: string;
  name: string;
  url: string;
  pages: number;
  default: boolean;
};

export const roleMeta: Record<MemberRole, { description: string; className: string }> = {
  Owner: { description: "Full control", className: "bg-clay-soft text-clay-dark" },
  Administrator: { description: "Manages site and people", className: "bg-selection text-action" },
  Publisher: { description: "Edits and publishes", className: "bg-published-soft text-published" },
  Editor: { description: "Edits without publishing", className: "bg-concept-soft text-concept" },
  Viewer: { description: "Read only", className: "bg-sunken text-ink-muted" },
};

export const languages = [
  { code: "en", name: "English" },
  { code: "nl", name: "Dutch" },
  { code: "de", name: "German" },
] as const;

export const branches = [
  { id: "blog", name: "Blog", language: "English" },
  { id: "news", name: "News", language: "English" },
  { id: "over-ons", name: "Over ons", language: "Dutch" },
] as const;

export const sections = [
  { id: "pages", name: "Pages", icon: "ph-tree-structure" },
  { id: "media", name: "Media", icon: "ph-image" },
  { id: "redirects", name: "Redirects", icon: "ph-arrow-bend-up-left" },
  { id: "navigation", name: "Header navigation", icon: "ph-browser" },
  { id: "footer", name: "Footer", icon: "ph-layout" },
  { id: "structured", name: "Structured content", icon: "ph-cube" },
  { id: "templates", name: "Page templates", icon: "ph-stack" },
] as const;

export const initialMembers: Member[] = [
  {
    id: "u1",
    name: "Alex Morgan",
    email: "alex@northstar.example",
    role: "Owner",
    scope: "full",
    languages: ["en", "nl", "de"],
    branches: [],
    sections: sections.map(({ id }) => id),
    lastActive: "just now",
    lastActiveExact: "Today at 14:20",
    current: true,
  },
  {
    id: "u2",
    name: "Mara Jensen",
    email: "mara@northstar.example",
    role: "Administrator",
    scope: "full",
    languages: ["en", "nl", "de"],
    branches: [],
    sections: sections.map(({ id }) => id),
    lastActive: "2h ago",
    lastActiveExact: "Today at 12:05",
  },
  {
    id: "u3",
    name: "Liam Chen",
    email: "liam@northstar.example",
    role: "Publisher",
    scope: "languages",
    languages: ["en", "nl"],
    branches: [],
    sections: ["pages", "media", "redirects"],
    lastActive: "yesterday",
    lastActiveExact: "20 July at 16:40",
  },
  {
    id: "u4",
    name: "Amina Yusuf",
    email: "amina@agency.example",
    role: "Editor",
    scope: "branches",
    languages: ["en"],
    branches: ["blog"],
    sections: ["pages", "media"],
    lastActive: "3 days ago",
    lastActiveExact: "18 July at 09:12",
  },
  {
    id: "u5",
    name: "Sofia Rossi",
    email: "sofia@agency.example",
    role: "Viewer",
    scope: "languages",
    languages: ["de"],
    branches: [],
    sections: ["pages", "media"],
    lastActive: "1 week ago",
    lastActiveExact: "14 July at 11:30",
  },
];

export const initialInvitations: Invitation[] = [
  {
    id: "i1",
    email: "editor@partner.example",
    role: "Editor",
    access: "Dutch · Pages",
    invitedBy: "Mara Jensen",
    sent: "2 days ago",
    status: "Pending",
  },
  {
    id: "i2",
    email: "reviewer@client.example",
    role: "Viewer",
    access: "Full site",
    invitedBy: "Alex Morgan",
    sent: "6 days ago",
    status: "Expiring soon",
  },
];

export const initialSiteLanguages: SiteLanguage[] = [
  { code: "EN", name: "English", url: "northstar.example/", pages: 128, default: true },
  { code: "NL", name: "Dutch", url: "northstar.example/nl/", pages: 64, default: false },
  { code: "DE", name: "German", url: "northstar.example/de/", pages: 12, default: false },
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function accessSummary(member: Member) {
  if (member.accessLabel) return member.accessLabel;
  if (member.scope === "full") return "Full site";

  if (member.scope === "languages") {
    return member.languages
      .map((code) => languages.find((language) => language.code === code)?.name)
      .filter(Boolean)
      .join(" and ");
  }

  return member.branches
    .map((id) => branches.find((branch) => branch.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

export function canManageSettings(role: ViewerRole) {
  return role === "owner" || role === "administrator";
}
