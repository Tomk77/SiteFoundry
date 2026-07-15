import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/app-shell";
import {
  Modal,
  ModalClose,
  ModalDescription,
  ModalTitle,
} from "../components/modal";
import { useAuth } from "../lib/auth";
import {
  deleteRedirect,
  getRedirectHealth,
  loadRedirectWorkspace,
  normalizeRedirectPath,
  saveRedirect,
  type RedirectRecord,
  type RedirectWorkspace,
} from "../lib/redirects";
import type { WorkspaceOption } from "../lib/page-tree";
import {
  createRedirectsUrlSearch,
  parseRedirectsUrlSearch,
} from "../lib/url-view-state";
import "../redirects.css";

export const Route = createFileRoute("/redirects")({
  validateSearch: parseRedirectsUrlSearch,
  component: Redirects,
});

const redirectWorkspaceCache = new Map<string, RedirectWorkspace>();

type Filter = "all" | "automatic" | "manual" | "attention";
type RedirectForm = {
  id?: string;
  automatic: boolean;
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302;
};

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

function Redirects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const urlSearch = Route.useSearch();
  const cacheKey = user?.id ?? "";
  const cachedWorkspace = cacheKey
    ? (redirectWorkspaceCache.get(cacheKey) ?? null)
    : null;
  const [workspace, setWorkspace] = useState<RedirectWorkspace | null>(
    cachedWorkspace,
  );
  const [selection, setSelection] = useState<{
    siteId?: string;
    languageId?: string;
  }>({});
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
      setError(
        reason instanceof Error ? reason.message : "Could not load redirects.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
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
    if (!form || !workspace)
      return { sourceError: "", destinationHint: "", valid: false };
    const source = normalizeRedirectPath(form.sourcePath);
    const destination = normalizeRedirectPath(form.destinationPath);
    let sourceError = "";
    if (!source) sourceError = "Enter a source path.";
    else if (source === "/") sourceError = "The homepage cannot be redirected.";
    else if (
      workspace.redirects.some(
        (item) => item.id !== form.id && item.sourcePath === source,
      )
    )
      sourceError = "A redirect already exists for this source path.";
    else if (source === destination)
      sourceError = "Source and destination must be different.";
    let destinationHint = "";
    if (!destination) destinationHint = "Enter a destination path.";
    else if (livePaths.has(destination)) destinationHint = "Live page";
    else if (
      workspace.redirects.some((item) => item.sourcePath === destination)
    )
      destinationHint =
        "This points to another redirect and will create a chain.";
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
      setModalError(
        reason instanceof Error ? reason.message : "Could not save redirect.",
      );
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
      setModalError(
        reason instanceof Error ? reason.message : "Could not delete redirect.",
      );
    } finally {
      setSaving(false);
    }
  };

  const switchWorkspace = (option: WorkspaceOption) => {
    const next = { siteId: option.siteId, languageId: option.languageId };
    setSelection(next);
    void load(next);
  };

  if (!workspace && loading)
    return (
      <AppShell active="redirects">
        <div className="sf-route-loading" role="status">
          <span className="sf-route-loading-mark">
            <i className="ph ph-arrow-bend-up-left" />
          </span>
          <strong>Loading redirects</strong>
          <small>Your workspace remains available while rules load.</small>
        </div>
      </AppShell>
    );
  if (!workspace)
    return (
      <div className="sf-loading">{error || "No website is available."}</div>
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
      <header className="sf-redirect-head">
        <div className="sf-tree-title">
          <div>
            <h1>Redirects</h1>
            <b>{counts.all} rules</b>
          </div>
          <span>
            Forwarding rules for this language tree · {workspace.language.name}{" "}
            · {workspace.language.code.toUpperCase()}
          </span>
        </div>
        <span className="sf-spacer" />
        <label className="sf-search sf-redirect-search">
          <i className="ph ph-magnifying-glass" />
          <Input unstyled
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search source or target..."
            value={query}
          />
          {query ? (
            <Button unstyled
              onClick={() => setQuery("")}
              title="Clear search"
              type="button"
            >
              <i className="ph ph-x" />
            </Button>
          ) : null}
        </label>
        <Button unstyled
          className="sf-action primary"
          onClick={() => {
            setModalError("");
            setForm({ ...emptyForm });
          }}
          type="button"
        >
          <i className="ph-bold ph-plus" /> Add redirect
        </Button>
      </header>

      <div className="sf-redirect-toolbar">
        <div className="sf-segmented" aria-label="Filter redirects">
          {(
            [
              ["all", "All"],
              ["automatic", "Automatic"],
              ["manual", "Manual"],
              ["attention", "Needs attention"],
            ] as const
          ).map(([value, label]) => (
            <Button unstyled
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
              <span className={value === "attention" ? "danger" : ""}>
                {counts[value]}
              </span>
            </Button>
          ))}
        </div>
        <span className="sf-spacer" />
        <span className="sf-mono sf-redirect-result">
          {visible.length} redirects
        </span>
      </div>

      {counts.attention ? (
        <div className="sf-attention-banner">
          <i className="ph-fill ph-warning-octagon" />
          <strong>
            {counts.attention} redirects point somewhere broken, chained, or
            looping.
          </strong>
          <span className="sf-spacer" />
          <Button unstyled onClick={() => setFilter("attention")} type="button">
            Review {counts.attention}
          </Button>
        </div>
      ) : null}

      <div className="sf-redirect-table-wrap sf-scroll">
        <div className="sf-redirect-table">
          <div className="sf-redirect-grid sf-redirect-columns">
            <span>Source path</span>
            <span />
            <span>Redirects to</span>
            <span>Type</span>
            <span>Origin</span>
            <span>Added</span>
            <span />
          </div>
          {error ? <div className="sf-redirect-error">{error}</div> : null}
          {!visible.length ? (
            <div className="sf-redirect-empty">
              <span className="sf-empty-icon">
                <i className="ph ph-signpost" />
              </span>
              <strong>
                {workspace.redirects.length
                  ? "No matching redirects"
                  : "No redirects yet"}
              </strong>
              <p>
                {workspace.redirects.length
                  ? "Try another search or filter."
                  : "Create a forwarding rule when an old URL should lead somewhere new."}
              </p>
              {!workspace.redirects.length ? (
                <Button unstyled
                  className="sf-action primary"
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
                  <div className="sf-redirect-group">
                    {group.label} <b>{group.items.length}</b>
                    <span />
                  </div>
                ) : null}
                {group.items.map((redirect) => {
                  const warning = health.get(redirect.id);
                  return (
                    <div
                      className="sf-redirect-grid sf-redirect-row"
                      key={redirect.id}
                      onClick={() => openEdit(redirect)}
                    >
                      <span className="sf-mono">{redirect.sourcePath}</span>
                      <i className="ph-bold ph-arrow-right" />
                      <span className="sf-redirect-destination">
                        <span className="sf-mono">
                          {redirect.destinationPath}
                        </span>
                        {warning ? (
                          <span
                            className={`sf-health ${warning.kind}`}
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
                      <span className="sf-redirect-type">
                        <b className="sf-mono">{redirect.statusCode}</b>
                        <small>
                          {redirect.statusCode === 301
                            ? "Permanent"
                            : "Temporary"}
                        </small>
                      </span>
                      <span className="sf-origin">
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
                      <span className="sf-redirect-date">
                        {formatDate(redirect.createdAt)}
                      </span>
                      <span className="sf-redirect-actions">
                        <Button unstyled
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(redirect);
                          }}
                          title="Edit"
                          type="button"
                        >
                          <i className="ph ph-pencil-simple" />
                        </Button>
                        <Button unstyled
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

      <footer className="sf-redirect-foot">
        <i className="ph ph-info" />
        Redirects are added automatically when a published page moves, changes
        slug, or is deleted
        <span className="sf-spacer" />
        <span className="sf-mono">{counts.attention} need attention</span>
      </footer>

      <Modal
        open={Boolean(form)}
        onOpenChange={(open) => !open && setForm(null)}
      >
        {form ? (
          <>
            <div className="sf-modal-head">
              <span className="sf-modal-icon">
                <i
                  className={`ph ${form.id ? "ph-pencil-simple" : "ph-signpost"}`}
                />
              </span>
              <div>
                <ModalTitle>
                  {form.id ? "Edit redirect" : "Add redirect"}
                </ModalTitle>
                <ModalDescription>
                  Forward one path in this language tree to another.
                </ModalDescription>
              </div>
              <span className="sf-spacer" />
              <ModalClose className="sf-modal-x">
                <i className="ph ph-x" />
              </ModalClose>
            </div>
            <div className="sf-redirect-modal-body">
              <label>
                <span>Source path</span>
                <Input unstyled
                  disabled={form.automatic}
                  onChange={(event) =>
                    setForm({ ...form, sourcePath: event.target.value })
                  }
                  placeholder="/old-path"
                  value={form.sourcePath}
                />
                {form.automatic ? (
                  <small>
                    Automatic redirect sources follow the page history.
                  </small>
                ) : formState.sourceError ? (
                  <small className="error">{formState.sourceError}</small>
                ) : null}
              </label>
              <label>
                <span>Redirects to</span>
                <Input unstyled
                  onChange={(event) =>
                    setForm({ ...form, destinationPath: event.target.value })
                  }
                  placeholder="/new-path"
                  value={form.destinationPath}
                />
                {formState.destinationHint ? (
                  <small
                    className={
                      formState.destinationHint === "Live page"
                        ? "success"
                        : "warning"
                    }
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
                  <Button unstyled
                    className={form.statusCode === code ? "active" : ""}
                    key={code}
                    onClick={() =>
                      setForm({ ...form, statusCode: code as 301 | 302 })
                    }
                    type="button"
                  >
                    <b>{code}</b>
                    <span>{code === 301 ? "Permanent" : "Temporary"}</span>
                  </Button>
                ))}
              </fieldset>
              {form.automatic ? (
                <p className="sf-origin-note">
                  <i className="ph ph-arrows-clockwise" /> Automatic redirect
                  created from a page change
                </p>
              ) : null}
              {modalError ? (
                <p className="sf-modal-error">{modalError}</p>
              ) : null}
            </div>
            <div className="sf-modal-actions">
              <ModalClose className="sf-action" disabled={saving}>
                Cancel
              </ModalClose>
              <Button unstyled
                className="sf-action primary"
                disabled={!formState.valid || saving}
                onClick={() => void submit()}
                type="button"
              >
                {saving
                  ? "Saving..."
                  : form.id
                    ? "Save redirect"
                    : "Add redirect"}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        className="sf-small-modal"
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <>
            <div className="sf-modal-head">
              <span className="sf-modal-icon danger">
                <i className="ph ph-trash" />
              </span>
              <div>
                <ModalTitle>Delete redirect?</ModalTitle>
                <ModalDescription>
                  This forwarding rule will stop working immediately.
                </ModalDescription>
              </div>
            </div>
            <div className="sf-delete-redirect-copy">
              <span className="sf-mono">{deleteTarget.sourcePath}</span>
              <i className="ph-bold ph-arrow-right" />
              <span className="sf-mono">{deleteTarget.destinationPath}</span>
              {modalError ? (
                <p className="sf-modal-error">{modalError}</p>
              ) : null}
            </div>
            <div className="sf-modal-actions">
              <ModalClose className="sf-action" disabled={saving}>
                Cancel
              </ModalClose>
              <Button unstyled
                className="sf-action danger"
                disabled={saving}
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
        <div className="sf-global-toast" role="status">
          <i className="ph-fill ph-check-circle" /> {toast}
        </div>
      ) : null}
    </AppShell>
  );
}
