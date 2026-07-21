import { Button } from "./ui/button";
import { LoadingSplash } from "./loading";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { WorkspaceOption } from "../lib/page-tree";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

const statusClasses = {
  Published: "bg-published-soft text-published",
  Concept: "bg-concept-soft text-concept",
  "Needs attention": "bg-danger-soft text-danger",
} as const;

export function StatusPill({ status }: { status: "Published" | "Concept" | "Needs attention" }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-[5px] rounded-[5px] px-2 text-[11.5px] font-semibold whitespace-nowrap before:size-[5px] before:rounded-full before:bg-current before:content-['']",
        statusClasses[status],
      )}
      data-status={status}
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
    | "page-templates"
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
  if (loading || !user) return <LoadingSplash />;
  const name = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Editor");
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
    ["Header navigation", "ph-browser", "header-navigation", "/header-navigation"],
    ["Footer", "ph-layout", "footer", "/footer"],
    ["Structured content", "ph-cube", "structured-content", "/structured-content"],
    ["Page templates", "ph-stack", "page-templates", "/page-templates"],
    ["Settings", "ph-gear", "settings", "/settings"],
  ] as const;
  return (
    <div className="sf-shell flex h-screen w-screen overflow-hidden border-t-[6px] border-app-chrome bg-surface">
      <aside className="max-[800px]:flex-basis-[210px] flex w-[244px] flex-[0_0_244px] flex-col border-r border-border bg-[#fafcfa] max-[800px]:w-[210px] dark:bg-surface">
        <div className="relative px-3.5 pt-3.5 pb-2">
          <Button
            aria-expanded={workspaceOpen}
            className="h-[46px] w-full justify-start gap-2.5 rounded-card px-2.5 text-left shadow-[0_1px_2px_rgb(23_35_38_/_4%)]"
            onClick={() => setWorkspaceOpen((value) => !value)}
            type="button"
            variant="outline"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-control bg-clay text-ink">
              <i className="ph ph-globe-hemisphere-west" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <strong className="overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap">
                {siteName}
              </strong>
              <small className="text-[11px] font-medium text-ink-subtle">
                {languageName} · {languageCode.toUpperCase()}
              </small>
            </span>
            <i className="ph ph-caret-up-down" />
          </Button>
          {workspaceOpen && workspaces?.length ? (
            <div className="absolute top-[66px] left-3.5 z-40 w-[216px] rounded-card border border-border bg-surface p-[5px] shadow-popover">
              {workspaces.map((workspace) => {
                const selected =
                  workspace.siteName === siteName && workspace.languageCode === languageCode;
                return (
                  <Button
                    className={cn(
                      "h-auto w-full justify-start gap-2 rounded-control border-0 bg-surface p-2 text-left font-normal shadow-none hover:bg-selection-surface",
                      selected && "bg-selection-surface",
                    )}
                    key={workspace.languageId}
                    onClick={() => {
                      onWorkspaceSelect?.(workspace);
                      setWorkspaceOpen(false);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <i className="ph ph-globe-hemisphere-west text-base text-action" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <strong className="overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap">
                        {workspace.siteName}
                      </strong>
                      <small className="text-[10.5px] text-ink-subtle">
                        {workspace.languageName} · {workspace.languageCode.toUpperCase()}
                      </small>
                    </span>
                    {selected ? <i className="ph-bold ph-check text-published" /> : null}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
        <nav className="flex flex-col gap-px px-2.5 py-2">
          <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-[#a5b0ad] uppercase">
            Content
          </div>
          {nav.map(([label, icon, key, to]) => (
            <Button
              aria-current={key === active ? "page" : undefined}
              className={cn(
                "h-[34px] w-full justify-start gap-[11px] rounded-lg border-0 px-2.5 text-[13px] font-medium text-ink hover:bg-[#f0f4f1] dark:hover:bg-sunken",
                key === active && "bg-selection text-action hover:bg-selection",
              )}
              key={label}
              onClick={() => to && void navigate({ to })}
              type="button"
              variant="ghost"
            >
              <i className={`ph ${icon} w-[17px] text-base`} />
              <span>{label}</span>
              {key === "pages" && pageCount !== undefined ? (
                <span className="ml-auto font-mono text-[11px] font-semibold text-[#a5b0ad]">
                  {pageCount}
                </span>
              ) : null}
            </Button>
          ))}
        </nav>
        <div className="flex-1" />
        <Link
          aria-label="Open personal settings"
          className="flex w-full items-center gap-2.5 border-t border-border bg-[#fafcfa] px-3 py-2.5 text-left text-inherit no-underline hover:bg-[#f0f4f1] dark:bg-surface dark:hover:bg-sunken"
          preload="intent"
          preloadDelay={0}
          to="/personal-settings"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-clay-soft text-[11px] font-bold text-clay-dark">
            {initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <strong className="text-[12.5px] font-medium">{name}</strong>
            <small className="text-[11px] text-ink-subtle">Owner</small>
          </span>
          <span className="flex-1" />
          <i className="ph ph-sliders-horizontal text-[#aebab6]" />
        </Link>
        <Button
          className="h-[34px] w-full gap-[7px] rounded-none border-0 border-t border-border bg-[#fafcfa] px-0 text-xs font-normal text-ink-muted shadow-none dark:bg-surface"
          onClick={() => void signOut()}
          type="button"
          variant="ghost"
        >
          <i className="ph ph-sign-out" /> Sign out
        </Button>
      </aside>
      <main className="sf-main flex min-w-0 flex-1 [animation:sf-route-enter_140ms_ease-out] flex-col bg-surface transition-colors motion-reduce:[animation:none] motion-reduce:transition-none">
        {children}
      </main>
    </div>
  );
}
