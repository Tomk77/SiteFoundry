import { Button } from "./ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { WorkspaceOption } from "../lib/page-tree";
import { useAuth } from "../lib/auth";
export function StatusPill({
  status,
}: {
  status: "Published" | "Concept" | "Needs attention";
}) {
  return (
    <span
      className={`sf-status ${status === "Published" ? "published" : status === "Concept" ? "concept" : "attention"}`}
    >
      {status}
    </span>
  );
}
export function AppShell({
  active,
  children,
  siteName = "My first site",
  languageName = "English",
  languageCode = "en",
  pageCount,
  workspaces,
  onWorkspaceSelect,
}: {
  active:
    | "pages"
    | "media"
    | "redirects"
    | "header-navigation"
    | "footer"
    | "structured-content"
    | "settings";
  children: ReactNode;
  siteName?: string;
  languageName?: string;
  languageCode?: string;
  pageCount?: number;
  workspaces?: WorkspaceOption[];
  onWorkspaceSelect?: (workspace: WorkspaceOption) => void;
}) {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);
  if (loading || !user)
    return <div className="sf-loading">Loading your workspace...</div>;
  const name = String(
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Editor",
  );
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
  const nav = [
    ["Pages", "ph-tree-structure", "pages", "/"],
    ["Media", "ph-image", "media", "/media"],
    ["Redirects", "ph-arrow-bend-up-left", "redirects", "/redirects"],
    [
      "Header navigation",
      "ph-browser",
      "header-navigation",
      "/header-navigation",
    ],
    ["Footer", "ph-layout", "footer", "/footer"],
    [
      "Structured content",
      "ph-cube",
      "structured-content",
      "/structured-content",
    ],
    ["Settings", "ph-gear", "", ""],
  ] as const;
  return (
    <div className="sf-shell">
      <aside className="sf-side">
        <div className="sf-site-wrap" style={{ position: "relative" }}>
          <Button unstyled
            className="sf-site"
            onClick={() => setWorkspaceOpen((value) => !value)}
            type="button"
          >
            <span className="sf-site-mark">
              <i className="ph ph-globe-hemisphere-west" />
            </span>
            <span className="sf-site-copy">
              <strong>{siteName}</strong>
              <small>
                {languageName} · {languageCode.toUpperCase()}
              </small>
            </span>
            <i className="ph ph-caret-up-down" />
          </Button>
          {workspaceOpen && workspaces?.length ? (
            <div className="sf-workspace-menu">
              {workspaces.map((workspace) => (
                <Button unstyled
                  className={
                    workspace.siteName === siteName &&
                    workspace.languageCode === languageCode
                      ? "active"
                      : ""
                  }
                  key={workspace.languageId}
                  onClick={() => {
                    onWorkspaceSelect?.(workspace);
                    setWorkspaceOpen(false);
                  }}
                  type="button"
                >
                  <i className="ph ph-globe-hemisphere-west" />
                  <span>
                    <strong>{workspace.siteName}</strong>
                    <small>
                      {workspace.languageName} ·{" "}
                      {workspace.languageCode.toUpperCase()}
                    </small>
                  </span>
                  {workspace.siteName === siteName &&
                  workspace.languageCode === languageCode ? (
                    <i className="ph-bold ph-check" />
                  ) : null}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        <nav className="sf-nav">
          <div className="sf-nav-label">Content</div>
          {nav.map(([label, icon, key, to]) => (
            <Button unstyled
              className={key === active ? "active" : ""}
              key={label}
              onClick={() => to && void navigate({ to })}
              type="button"
            >
              <i className={`ph ${icon}`} />
              <span>{label}</span>
              {key === "pages" && pageCount !== undefined ? (
                <span className="sf-nav-count">{pageCount}</span>
              ) : null}
            </Button>
          ))}
        </nav>
        <div className="sf-spacer" />
        <Button unstyled
          aria-label="Open personal settings"
          className="sf-user"
          onClick={() => void navigate({ to: "/personal-settings" })}
          type="button"
        >
          <span className="sf-avatar">{initials}</span>
          <span className="sf-user-copy">
            <strong>{name}</strong>
            <small>Owner</small>
          </span>
          <span className="sf-spacer" />
          <i
            className="ph ph-sliders-horizontal"
            style={{ color: "#AEBAB6" }}
          />
        </Button>
        <Button unstyled
          className="sf-signout"
          onClick={() => void signOut()}
          type="button"
        >
          <i className="ph ph-sign-out" /> Sign out
        </Button>
      </aside>
      <main className="sf-main">{children}</main>
    </div>
  );
}
