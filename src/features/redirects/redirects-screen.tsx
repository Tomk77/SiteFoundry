import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AppShellSkeleton, LoadingSplash } from "@/components/loading";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "@/components/modal";
import { useRequireAuth } from "@/lib/use-require-auth";
import {
  deleteRedirect,
  getRedirectHealth,
  loadRedirectWorkspace,
  normalizeRedirectPath,
  saveRedirect,
  type RedirectRecord,
  type RedirectWorkspace,
} from "@/lib/redirects";
import type { WorkspaceOption } from "@/lib/page-tree";
import { createRedirectsUrlSearch, type parseRedirectsUrlSearch } from "@/lib/url-view-state";

const redirectWorkspaceCache = new Map<string, RedirectWorkspace>();

type Filter = "all" | "automatic" | "manual" | "attention";
interface RedirectForm {
  id?: string;
  automatic: boolean;
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302;
}

const emptyForm: RedirectForm = {
  automatic: false,
  sourcePath: "",
  destinationPath: "",
  statusCode: 301,
};

function formatDate(value: string) {
  const date = new Date(value);
  const current = new Date();
  if (date.toDateString() === current.toDateString()) return "Today";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function RedirectsScreen({
  urlSearch,
}: {
  urlSearch: ReturnType<typeof parseRedirectsUrlSearch>;
}) {
  const { user, ready } = useRequireAuth();
  const navigate = useNavigate({ from: "/redirects" });
  const cacheKey = user?.id ?? "";
  const cachedWorkspace = cacheKey ? (redirectWorkspaceCache.get(cacheKey) ?? null) : null;
  const [workspace, setWorkspace] = useState<RedirectWorkspace | null>(cachedWorkspace);
  const [selection, setSelection] = useState<{ siteId?: string; languageId?: string }>({});
  const [loading, setLoading] = useState(!cachedWorkspace);
  const [error, setError] = useState("");
  const [form, setForm] = useState<RedirectForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RedirectRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = urlSearch.q ?? "";
  const filter: Filter = urlSearch.filter ?? "all";
  const updateUrlView = (nextQuery: string, nextFilter: Filter) => {
    void navigate({
      to: "/redirects",
      search: createRedirectsUrlSearch({
        q: nextQuery,
        filter: nextFilter,
      }),
      replace: true,
      resetScroll: false,
    });
  };

  const setQuery = (value: string) => updateUrlView(value, filter);
  const setFilter = (value: Filter) => updateUrlView(query, value);

  const load = async (next = selection) => {
    setLoading(true);
    setError("");
    try {
      const data = await loadRedirectWorkspace(next);
      if (data && user?.id) redirectWorkspaceCache.set(user.id, data);
      setWorkspace(data);
      if (data) {
        setSelection({
          siteId: data.site.id,
          languageId: data.language.id,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load redirects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
    // The loader intentionally starts from the default workspace when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const livePaths = useMemo(
    () => new Set(workspace?.livePages.map((page) => page.path) ?? []),
    [workspace],
  );
  const health = useMemo(
    () =>
      new Map(
        (workspace?.redirects ?? []).map((redirect) => [
          redirect.id,
          getRedirectHealth(redirect, livePaths, workspace?.redirects ?? []),
        ]),
      ),
    [workspace, livePaths],
  );
  const counts = useMemo(() => {
    const redirects = workspace?.redirects ?? [];

    return {
      all: redirects.length,
      automatic: redirects.filter((item) => item.pageId).length,
      manual: redirects.filter((item) => !item.pageId).length,
      attention: redirects.filter((item) => health.get(item.id)).length,
    };
  }, [workspace, health]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (workspace?.redirects ?? []).filter((item) => {
      const matchesSearch =
        !needle ||
        item.sourcePath.toLowerCase().includes(needle) ||
        item.destinationPath.toLowerCase().includes(needle);
      const matchesFilter =
        filter === "all" ||
        (filter === "automatic" && Boolean(item.pageId)) ||
        (filter === "manual" && !item.pageId) ||
        (filter === "attention" && Boolean(health.get(item.id)));

      return matchesSearch && matchesFilter;
    });
  }, [workspace, query, filter, health]);

  const groups = useMemo(() => {
    if (filter !== "all") return [{ label: "", items: visible }];

    return [
      {
        label: "Manual redirects",
        items: visible.filter((item) => !item.pageId),
      },
      {
        label: "Automatic redirects",
        items: visible.filter((item) => item.pageId),
      },
    ].filter((group) => group.items.length);
  }, [filter, visible]);

  const formState = useMemo(() => {
    if (!form || !workspace) return { sourceError: "", destinationHint: "", valid: false };
    const source = normalizeRedirectPath(form.sourcePath);
    const destination = normalizeRedirectPath(form.destinationPath);
    let sourceError = "";
    if (!source) sourceError = "Enter a source path.";
    else if (source === "/") sourceError = "The homepage cannot be redirected.";
    else if (workspace.redirects.some((item) => item.id !== form.id && item.sourcePath === source))
      sourceError = "A redirect already exists for this source path.";
    else if (source === destination) sourceError = "Source and destination must be different.";
    let destinationHint = "";
    if (!destination) destinationHint = "Enter a destination path.";
    else if (livePaths.has(destination)) destinationHint = "Live page";
    else if (workspace.redirects.some((item) => item.sourcePath === destination))
      destinationHint = "This points to another redirect and will create a chain.";
    else destinationHint = "No live page currently uses this path.";

    return {
      sourceError,
      destinationHint,
      valid: Boolean(source && destination && !sourceError),
    };
  }, [form, workspace, livePaths]);

  const openEdit = (redirect: RedirectRecord) => {
    setModalError("");
    setForm({
      id: redirect.id,
      automatic: Boolean(redirect.pageId),
      sourcePath: redirect.sourcePath,
      destinationPath: redirect.destinationPath,
      statusCode: redirect.statusCode,
    });
  };

  const submit = async () => {
    if (!form || !workspace || !formState.valid || saving) return;
    setSaving(true);
    setModalError("");
    try {
      await saveRedirect({
        id: form.id,
        siteLanguageId: workspace.language.id,
        sourcePath: form.sourcePath,
        destinationPath: form.destinationPath,
        statusCode: form.statusCode,
      });
      const edited = Boolean(form.id);
      setForm(null);
      await load(selection);
      showToast(edited ? "Redirect updated" : "Redirect created");
    } catch (reason) {
      setModalError(reason instanceof Error ? reason.message : "Could not save redirect.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    setModalError("");
    try {
      await deleteRedirect(deleteTarget.id);
      setDeleteTarget(null);
      await load(selection);
      showToast("Redirect deleted");
    } catch (reason) {
      setModalError(reason instanceof Error ? reason.message : "Could not delete redirect.");
    } finally {
      setSaving(false);
    }
  };

  const switchWorkspace = (option: WorkspaceOption) => {
    const next = { siteId: option.siteId, languageId: option.languageId };
    setSelection(next);
    void load(next);
  };

  if (!ready) return <LoadingSplash />;
  if (!workspace && loading)
    return <AppShellSkeleton active="redirects" label="Loading redirects" variant="table" />;
  if (!workspace)
    return (
      <div className="sc-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
        {error || "No website is available."}
      </div>
    );

  return (
    <AppShell
      active="redirects"
      languageCode={workspace.language.code}
      languageName={workspace.language.name}
      onWorkspaceSelect={switchWorkspace}
      pageCount={workspace.pageCount}
      siteName={workspace.site.name}
      workspaces={workspace.workspaces}
    >
      <header className="sc-redirect-head [display:flex] [align-items:center] [gap:12px] [padding:16px_22px_14px] [border-bottom:1px_solid_var(--sc-sunken)] max-[900px]:[flex-wrap:wrap] dark:[border-color:#323841] dark:[background:#1d2126]">
        <div className="sc-tree-title [display:flex] [flex-direction:column] [gap:1px] [&_b]:text-ink-subtle [&_b]:[font:500_12px_'Geist_Mono'] [&_div]:[display:flex] [&_div]:[align-items:center] [&_div]:[gap:9px] [&_h1]:[margin:0] [&_h1]:[font-size:19px] [&_h1]:[font-weight:600] [&_h1]:[letter-spacing:-0.015em] [&>span]:[font-size:12px] [&>span]:text-ink-subtle">
          <div>
            <h1>Redirects</h1>
            <b>{counts.all} rules</b>
          </div>
          <span>
            Forwarding rules for this language tree · {workspace.language.name} ·{" "}
            {workspace.language.code.toUpperCase()}
          </span>
        </div>
        <span className="sc-spacer [flex:1]" />
        <label className="sc-search sc-redirect-search [display:flex] [height:36px] [width:248px] [align-items:center] [gap:8px] [border-radius:8px] bg-surface [padding:0_12px] [border:1.5px_solid_#cfd6d0] max-[900px]:[width:210px] max-[800px]:[width:190px] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_button]:[display:grid] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[padding:0] [&_button]:[color:#aeb6b3] [&_button]:[background:transparent] [&_button]:[border:0] [&_i]:[font-size:15px] [&_i]:text-ink-subtle [&_input]:[width:100%] [&_input]:[padding:0] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
          <i className="ph ph-magnifying-glass" />
          <Input
            unstyled
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search source or target..."
            value={query}
          />
          {query ? (
            <Button unstyled onClick={() => setQuery("")} title="Clear search" type="button">
              <i className="ph ph-x" />
            </Button>
          ) : null}
        </label>
        <Button
          unstyled
          className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          onClick={() => {
            setModalError("");
            setForm({ ...emptyForm });
          }}
          type="button"
        >
          <i className="ph-bold ph-plus" /> Add redirect
        </Button>
      </header>

      <div className="sc-redirect-toolbar [display:flex] [align-items:center] [gap:14px] [padding:11px_22px] [background:#fafcfa] [border-bottom:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] dark:[background:#1d2126]">
        <div
          className="sc-segmented [display:flex] [gap:2px] [border-radius:8px] bg-sunken [padding:2px] dark:[background:#15181c] [&_button]:[display:inline-flex] [&_button]:[height:28px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[border-radius:6px] [&_button]:[padding:0_12px] [&_button]:[font-size:12.5px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] dark:[&_button]:[color:#a7aeb8] [&_button_span]:[display:inline-grid] [&_button_span]:[height:17px] [&_button_span]:[min-width:17px] [&_button_span]:[place-items:center] [&_button_span]:[border-radius:999px] [&_button_span]:[padding:0_5px] [&_button_span]:[background:#dce3de] [&_button_span]:[font:700_10.5px_'Geist_Mono',_monospace] dark:[&_button_span]:[color:#a7aeb8] dark:[&_button_span]:[background:#323841] [&_button_span.danger]:text-danger [&_button_span.danger]:[background:#f3d9d4] dark:[&_button_span.danger]:[color:#f0857a] dark:[&_button_span.danger]:[background:#3b2422] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgb(23_35_38_/_10%)] dark:[&_button.active]:[color:#b994f8] dark:[&_button.active]:[box-shadow:inset_0_0_0_1px_#285c60] dark:[&_button.active]:[background:#2c333b] [&_button.active_span]:bg-action [&_button.active_span]:[color:#fff] dark:[&_button.active_span]:[color:#150c22] dark:[&_button.active_span]:[background:#b994f8] dark:[&_button:hover]:[color:#e9ecf1] dark:[&_button:hover]:[background:#242930]"
          aria-label="Filter redirects"
        >
          {(
            [
              ["all", "All"],
              ["automatic", "Automatic"],
              ["manual", "Manual"],
              ["attention", "Needs attention"],
            ] as const
          ).map(([value, label]) => (
            <Button
              unstyled
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
              <span className={value === "attention" ? "danger" : ""}>{counts[value]}</span>
            </Button>
          ))}
        </div>
        <span className="sc-spacer [flex:1]" />
        <span className="sc-mono sc-redirect-result [font-family:'Geist_Mono',_monospace] [font-size:12px] text-ink-subtle dark:[color:#79808b]">
          {visible.length} redirects
        </span>
      </div>

      {counts.attention ? (
        <div className="sc-attention-banner [display:flex] [animation:sc-slide-in_160ms_ease-out] [align-items:center] [gap:11px] bg-danger-soft [padding:10px_22px] [font-size:13px] [color:#7c2a21] [border-bottom:1px_solid_#f0d2cc] motion-reduce:[animation:none] motion-reduce:[transition:none] dark:[border-color:#653a36] dark:[color:#f0b0a9] dark:[background:#321f1e] [&_button]:[height:28px] [&_button]:[cursor:pointer] [&_button]:[border-radius:7px] [&_button]:bg-surface [&_button]:[padding:0_11px] [&_button]:[font-size:12.5px] [&_button]:[font-weight:600] [&_button]:text-danger [&_button]:[border:1px_solid_#e4b3ab] dark:[&_button]:[border-color:#723c37] dark:[&_button]:[color:#f0857a] dark:[&_button]:[background:#1d2126] [&>i]:[font-size:17px] [&>i]:text-danger dark:[&>i]:[color:#f0857a]">
          <i className="ph-fill ph-warning-octagon" />
          <strong>{counts.attention} redirects point somewhere broken, chained, or looping.</strong>
          <span className="sc-spacer [flex:1]" />
          <Button unstyled onClick={() => setFilter("attention")} type="button">
            Review {counts.attention}
          </Button>
        </div>
      ) : null}

      <div className="sc-redirect-table-wrap sc-scroll [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] dark:[background:#15181c] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
        <div className="sc-redirect-table [min-width:900px] dark:[background:#15181c]">
          <div className="sc-redirect-grid sc-redirect-columns [position:sticky] [top:0] [z-index:3] [display:grid] [height:35px] [grid-template-columns:minmax(150px,_1.4fr)_22px_minmax(150px,_1.4fr)_92px_176px_96px_80px] [align-items:center] [gap:12px] bg-surface [padding-inline:22px] [font-size:10.5px] [font-weight:600] [letter-spacing:0.06em] [color:#a5b0ad] [text-transform:uppercase] [border-bottom:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[color:#79808b] dark:[background:#242930]">
            <span>Source path</span>
            <span />
            <span>Redirects to</span>
            <span>Type</span>
            <span>Origin</span>
            <span>Added</span>
            <span />
          </div>
          {error ? (
            <div className="sc-redirect-error bg-danger-soft [padding:12px_22px] [font-size:12.5px] text-danger dark:[color:#f0857a] dark:[background:#321f1e]">
              {error}
            </div>
          ) : null}
          {!visible.length ? (
            <div className="sc-redirect-empty [display:flex] [min-height:360px] [flex-direction:column] [align-items:center] [justify-content:center] [gap:10px] [padding:40px] [text-align:center] [&_p]:[margin:0_0_6px] [&_p]:[max-width:380px] [&_p]:[font-size:13.5px] [&_p]:[line-height:1.55] [&_p]:text-ink-muted dark:[&_p]:[color:#a7aeb8]">
              <span className="sc-empty-icon [margin-bottom:6px] [display:grid] [height:64px] [width:64px] [place-items:center] [border-radius:16px] bg-selection [font-size:30px] text-action dark:[color:#b994f8] dark:[background:#2c333b]">
                <i className="ph ph-signpost" />
              </span>
              <strong>
                {workspace.redirects.length ? "No matching redirects" : "No redirects yet"}
              </strong>
              <p>
                {workspace.redirects.length
                  ? "Try another search or filter."
                  : "Create a forwarding rule when an old URL should lead somewhere new."}
              </p>
              {!workspace.redirects.length ? (
                <Button
                  unstyled
                  className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                  onClick={() => setForm({ ...emptyForm })}
                  type="button"
                >
                  Add redirect
                </Button>
              ) : null}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label || "filtered"}>
                {group.label ? (
                  <div className="sc-redirect-group [display:flex] [align-items:center] [gap:8px] [padding:14px_42px_7px] [font-size:11px] [font-weight:600] [letter-spacing:0.05em] [color:#8a9895] [text-transform:uppercase] dark:[color:#a7aeb8] [&_b]:[color:#b7c0bd] [&_b]:[font:600_11px_'Geist_Mono',_monospace] dark:[&_b]:[color:#79808b] [&_span]:[height:1px] [&_span]:[flex:1] [&_span]:bg-sunken dark:[&_span]:[background:#3d444e]">
                    {group.label} <b>{group.items.length}</b>
                    <span />
                  </div>
                ) : null}
                {group.items.map((redirect) => {
                  const warning = health.get(redirect.id);

                  return (
                    <div
                      className="sc-redirect-grid sc-redirect-row [display:grid] [min-height:61px] [cursor:pointer] [grid-template-columns:minmax(150px,_1.4fr)_22px_minmax(150px,_1.4fr)_92px_176px_96px_80px] [align-items:center] [gap:12px] bg-surface [padding-inline:22px] [border-bottom:1px_solid_var(--sc-canvas)] [transition:background_120ms_ease] dark:[border-color:#263235] dark:[background:#1d2126] [&:hover]:[background:#fafcfa] dark:[&:hover]:[background:#242930] [&>.sc-mono]:[overflow:hidden] [&>.sc-mono]:[font-size:12.5px] [&>.sc-mono]:[text-overflow:ellipsis] [&>.sc-mono]:[white-space:nowrap] [&>.sc-mono]:text-ink dark:[&>.sc-mono]:[color:#e9ecf1] [&>i]:[font-size:14px] [&>i]:[color:#b7c0bd] dark:[&>i]:[color:#647572]"
                      key={redirect.id}
                      onClick={() => openEdit(redirect)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        openEdit(redirect);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
                        {redirect.sourcePath}
                      </span>
                      <i className="ph-bold ph-arrow-right" />
                      <span className="sc-redirect-destination [display:flex] [min-width:0] [align-items:center] [gap:8px] [&>.sc-mono]:[overflow:hidden] [&>.sc-mono]:[font-size:12.5px] [&>.sc-mono]:[text-overflow:ellipsis] [&>.sc-mono]:[white-space:nowrap] dark:[&>.sc-mono]:[color:#e9ecf1]">
                        <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
                          {redirect.destinationPath}
                        </span>
                        {warning ? (
                          <span
                            className={`sc-health [display:inline-flex] [height:20px] [flex:none] [align-items:center] [gap:4px] [border-radius:5px] [padding:0_7px] [font-size:11px] [font-weight:600] [white-space:nowrap] [&.broken]:bg-danger-soft [&.broken]:text-danger dark:[&.broken]:[color:#f0857a] dark:[&.broken]:[background:#321f1e] [&.chained]:bg-concept-soft [&.chained]:text-concept dark:[&.chained]:[color:#e0b341] dark:[&.chained]:[background:#2c281c] [&.loop]:bg-danger-soft [&.loop]:text-danger dark:[&.loop]:[color:#f0857a] dark:[&.loop]:[background:#321f1e] ${warning.kind}`}
                            title={warning.detail}
                          >
                            <i
                              className={`ph-fill ${
                                warning.kind === "chained"
                                  ? "ph-link"
                                  : warning.kind === "loop"
                                    ? "ph-arrows-clockwise"
                                    : "ph-warning-circle"
                              }`}
                            />
                            {warning.label}
                          </span>
                        ) : null}
                      </span>
                      <span className="sc-redirect-type [display:flex] [min-width:0] [flex-direction:column] [line-height:1.15] [&_b]:[font-size:12.5px] [&_b]:[color:#33474a] dark:[&_b]:[color:#e9ecf1] [&_small]:[overflow:hidden] [&_small]:[font-size:10.5px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:#9aa8a4] dark:[&_small]:[color:#79808b]">
                        <b className="sc-mono [font-family:'Geist_Mono',_monospace]">
                          {redirect.statusCode}
                        </b>
                        <small>{redirect.statusCode === 301 ? "Permanent" : "Temporary"}</small>
                      </span>
                      <span className="sc-origin [display:flex] [min-width:0] [flex-direction:column] [gap:3px] [&_b]:[display:inline-flex] [&_b]:[height:20px] [&_b]:[width:fit-content] [&_b]:[align-items:center] [&_b]:[gap:5px] [&_b]:[border-radius:5px] [&_b]:[padding:0_8px] [&_b]:[font-size:11px] [&_b]:[font-weight:600] [&_b.automatic]:bg-sunken [&_b.automatic]:text-ink-muted dark:[&_b.automatic]:[color:#a7aeb8] dark:[&_b.automatic]:[background:#263336] [&_b.manual]:bg-selection [&_b.manual]:text-action dark:[&_b.manual]:[color:#b994f8] dark:[&_b.manual]:[background:#2c333b] [&_small]:[overflow:hidden] [&_small]:[font-size:10.5px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:#9aa8a4] dark:[&_small]:[color:#79808b]">
                        <b className={redirect.pageId ? "automatic" : "manual"}>
                          <i
                            className={`ph ${redirect.pageId ? "ph-arrows-clockwise" : "ph-pencil-simple"}`}
                          />
                          {redirect.pageId ? "Automatic" : "Manual"}
                        </b>
                        <small>
                          {redirect.pageId
                            ? `Page moved${redirect.pageTitle ? ` · ${redirect.pageTitle}` : ""}`
                            : "Added manually"}
                        </small>
                      </span>
                      <span className="sc-redirect-date [font-size:12px] text-ink-subtle dark:[color:#79808b]">
                        {formatDate(redirect.createdAt)}
                      </span>
                      <span className="sc-redirect-actions [display:flex] [justify-content:flex-end] [gap:2px] [&_button]:[display:grid] [&_button]:[height:28px] [&_button]:[width:28px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:6px] [&_button]:[padding:0] [&_button]:[color:#aebab6] [&_button]:[background:transparent] [&_button]:[border:0] dark:[&_button]:[color:#647572] [&_button:hover:first-child]:bg-selection [&_button:hover:first-child]:text-action dark:[&_button:hover:first-child]:[color:#b994f8] dark:[&_button:hover:first-child]:[background:#2c333b] [&_button:hover:last-child]:bg-danger-soft [&_button:hover:last-child]:text-danger dark:[&_button:hover:last-child]:[color:#f0857a] dark:[&_button:hover:last-child]:[background:#321f1e]">
                        <Button
                          unstyled
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(redirect);
                          }}
                          title="Edit"
                          type="button"
                        >
                          <i className="ph ph-pencil-simple" />
                        </Button>
                        <Button
                          unstyled
                          onClick={(event) => {
                            event.stopPropagation();
                            setModalError("");
                            setDeleteTarget(redirect);
                          }}
                          title="Delete"
                          type="button"
                        >
                          <i className="ph ph-trash" />
                        </Button>
                      </span>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>

      <footer className="sc-redirect-foot [display:flex] [align-items:center] [gap:7px] [padding:9px_22px] [font-size:12px] text-ink-subtle [background:#fafcfa] [border-top:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] dark:[color:#79808b] dark:[background:#1d2126] [&>i]:[font-size:15px] [&>i]:text-action dark:[&>i]:[color:#b994f8]">
        <i className="ph ph-info" />
        Redirects are added automatically when a published page moves, changes slug, or is deleted
        <span className="sc-spacer [flex:1]" />
        <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
          {counts.attention} need attention
        </span>
      </footer>

      <Modal open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        {form ? (
          <>
            <div className="sc-modal-head [display:flex] [align-items:flex-start] [gap:12px] [padding:20px_22px_16px] [border-bottom:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] [&_h2]:[margin:0] [&_h2]:[font-size:16px] [&_h2]:[font-weight:600] dark:[&_h2]:[color:#e9ecf1] [&_p]:[margin:2px_0_0] [&_p]:[font-size:12.5px] [&_p]:text-ink-muted dark:[&_p]:[color:#79808b]">
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-selection text-[19px] text-action">
                <i className={`ph ${form.id ? "ph-pencil-simple" : "ph-signpost"}`} />
              </span>
              <div>
                <ModalTitle>{form.id ? "Edit redirect" : "Add redirect"}</ModalTitle>
                <ModalDescription>
                  Forward one path in this language tree to another.
                </ModalDescription>
              </div>
              <span className="sc-spacer [flex:1]" />
              <ModalClose className="sc-modal-x [display:grid] [cursor:pointer] [place-items:center] [padding:2px] [font-size:18px] text-ink-subtle [background:transparent] [border:0]">
                <i className="ph ph-x" />
              </ModalClose>
            </div>
            <div className="sc-redirect-modal-body [display:flex] [flex-direction:column] [gap:16px] [padding:18px_22px] [&_fieldset]:[display:grid] [&_fieldset]:[grid-template-columns:1fr_1fr] [&_fieldset]:[gap:8px] [&_fieldset]:[padding:0] [&_fieldset]:[border:0] [&_fieldset_button]:[display:flex] [&_fieldset_button]:[height:48px] [&_fieldset_button]:[cursor:pointer] [&_fieldset_button]:[flex-direction:column] [&_fieldset_button]:[justify-content:center] [&_fieldset_button]:[border-radius:8px] [&_fieldset_button]:bg-surface [&_fieldset_button]:[padding:0_12px] [&_fieldset_button]:[text-align:left] [&_fieldset_button]:[border:1.5px_solid_var(--sc-field)] dark:[&_fieldset_button]:[border-color:#3d444e] dark:[&_fieldset_button]:[color:#e9ecf1] dark:[&_fieldset_button]:[background:#15181c] [&_fieldset_button_b]:[font:600_13px_'Geist_Mono',_monospace] [&_fieldset_button_span]:[font-size:11px] [&_fieldset_button_span]:text-ink-subtle dark:[&_fieldset_button_span]:[color:#79808b] [&_fieldset_button.active]:border-action [&_fieldset_button.active]:bg-action-soft [&_fieldset_button.active]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_10%)] dark:[&_fieldset_button.active]:[border-color:#b994f8] dark:[&_fieldset_button.active]:[box-shadow:0_0_0_3px_rgb(185_148_248_/_12%)] dark:[&_fieldset_button.active]:[background:#2c333b] [&_input]:[height:40px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_12px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sc-field)] [&_input]:[font:13px_'Geist_Mono',_monospace] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:disabled]:bg-sunken [&_input:disabled]:[color:#71807d] dark:[&_input:disabled]:[color:#79808b] dark:[&_input:disabled]:[background:#242930] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_16%)] dark:[&_input:focus]:[border-color:#b994f8] dark:[&_input:focus]:[box-shadow:0_0_0_3px_rgb(185_148_248_/_18%)] [&_label>span]:[font-size:12px] [&_label>span]:[font-weight:600] [&_label>span]:[color:#33474a] dark:[&_label>span]:[color:#a7aeb8] [&_legend]:[margin-bottom:6px] [&_legend]:[font-size:12px] [&_legend]:[font-weight:600] [&_legend]:[color:#33474a] dark:[&_legend]:[color:#a7aeb8] [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_small_i]:[margin-right:4px] [&_small.error]:text-danger dark:[&_small.error]:[color:#f0857a] [&_small.success]:text-published dark:[&_small.success]:[color:#4fbe86] [&_small.warning]:text-concept dark:[&_small.warning]:[color:#e0b341] [&>label]:[display:flex] [&>label]:[flex-direction:column] [&>label]:[gap:6px]">
              <label>
                <span>Source path</span>
                <Input
                  unstyled
                  disabled={form.automatic}
                  onChange={(event) => setForm({ ...form, sourcePath: event.target.value })}
                  placeholder="/old-path"
                  value={form.sourcePath}
                />
                {form.automatic ? (
                  <small>Automatic redirect sources follow the page history.</small>
                ) : formState.sourceError ? (
                  <small className="error">{formState.sourceError}</small>
                ) : null}
              </label>
              <label>
                <span>Redirects to</span>
                <Input
                  unstyled
                  onChange={(event) => setForm({ ...form, destinationPath: event.target.value })}
                  placeholder="/new-path"
                  value={form.destinationPath}
                />
                {formState.destinationHint ? (
                  <small
                    className={formState.destinationHint === "Live page" ? "success" : "warning"}
                  >
                    <i
                      className={`ph-fill ${
                        formState.destinationHint === "Live page"
                          ? "ph-check-circle"
                          : "ph-warning-circle"
                      }`}
                    />
                    {formState.destinationHint}
                  </small>
                ) : null}
              </label>
              <fieldset>
                <legend>Redirect type</legend>
                {[301, 302].map((code) => (
                  <Button
                    unstyled
                    className={form.statusCode === code ? "active" : ""}
                    key={code}
                    onClick={() => setForm({ ...form, statusCode: code as 301 | 302 })}
                    type="button"
                  >
                    <b>{code}</b>
                    <span>{code === 301 ? "Permanent" : "Temporary"}</span>
                  </Button>
                ))}
              </fieldset>
              {form.automatic ? (
                <p className="sc-origin-note [margin:0] [display:flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle dark:[color:#79808b]">
                  <i className="ph ph-arrows-clockwise" /> Automatic redirect created from a page
                  change
                </p>
              ) : null}
              {modalError ? (
                <p className="sc-modal-error [margin:0] [border-radius:7px] bg-danger-soft [padding:9px_10px] [font-size:12px] text-danger">
                  {modalError}
                </p>
              ) : null}
            </div>
            <div className="sc-modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [padding:14px_22px] [background:#fafcfa] [border-top:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] dark:[background:#242930] [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.5]">
              <ModalClose
                className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={saving}
              >
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={!formState.valid || saving}
                loading={saving}
                onClick={() => void submit()}
                type="button"
              >
                {saving ? "Saving..." : form.id ? "Save redirect" : "Add redirect"}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        className="!w-[min(460px,100%)]"
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <>
            <div className="sc-modal-head [display:flex] [align-items:flex-start] [gap:12px] [padding:20px_22px_16px] [border-bottom:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] [&_h2]:[margin:0] [&_h2]:[font-size:16px] [&_h2]:[font-weight:600] dark:[&_h2]:[color:#e9ecf1] [&_p]:[margin:2px_0_0] [&_p]:[font-size:12.5px] [&_p]:text-ink-muted dark:[&_p]:[color:#79808b]">
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-danger-soft text-[19px] text-danger">
                <i className="ph ph-trash" />
              </span>
              <div>
                <ModalTitle>Delete redirect?</ModalTitle>
                <ModalDescription>
                  This forwarding rule will stop working immediately.
                </ModalDescription>
              </div>
            </div>
            <div className="sc-delete-redirect-copy [display:grid] [grid-template-columns:minmax(0,_1fr)_auto_minmax(0,_1fr)] [align-items:center] [gap:8px] [padding:22px] [font-size:12px] dark:[color:#e9ecf1] [&_.sc-modal-error]:[grid-column:1_/_-1] [&_span]:[overflow:hidden] [&_span]:[text-overflow:ellipsis]">
              <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
                {deleteTarget.sourcePath}
              </span>
              <i className="ph-bold ph-arrow-right" />
              <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
                {deleteTarget.destinationPath}
              </span>
              {modalError ? (
                <p className="sc-modal-error [margin:0] [border-radius:7px] bg-danger-soft [padding:9px_10px] [font-size:12px] text-danger">
                  {modalError}
                </p>
              ) : null}
            </div>
            <div className="sc-modal-actions [display:flex] [justify-content:flex-end] [gap:8px] [padding:14px_22px] [background:#fafcfa] [border-top:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] dark:[background:#242930] [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.5]">
              <ModalClose
                className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={saving}
              >
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sc-action danger [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={saving}
                loading={saving}
                onClick={() => void remove()}
                type="button"
              >
                {saving ? "Deleting..." : "Delete redirect"}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      {toast ? (
        <div
          className="fixed bottom-[26px] left-1/2 z-[70] flex -translate-x-1/2 animate-in items-center gap-2.5 rounded-[11px] bg-ink px-4 py-3 text-[13px] text-white shadow-[0_14px_40px_rgb(23_35_38_/_32%)] duration-200 fade-in-0 slide-in-from-bottom-2 dark:border dark:border-field dark:bg-sunken dark:text-ink [&_i]:text-lg [&_i]:text-[#b994f8]"
          role="status"
        >
          <i className="ph-fill ph-check-circle" /> {toast}
        </div>
      ) : null}
    </AppShell>
  );
}
