import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type CSSProperties,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppShell, StatusPill } from "../components/app-shell";
import {
  Modal,
  ModalClose,
  ModalDescription,
  ModalTitle,
} from "../components/modal";
import { useAuth } from "../lib/auth";
import {
  createChildPage,
  deletePage,
  loadPageTreeWorkspace,
  movePage,
  renamePage,
  type PageDropPosition,
  type PageNode,
  type PageTreeWorkspace,
  type WorkspaceOption,
} from "../lib/page-tree";
import {
  createPageTreeUrlSearch,
  parsePageTreeUrlSearch,
} from "../lib/url-view-state";
import "../overview.css";

export const Route = createFileRoute("/")({
  validateSearch: parsePageTreeUrlSearch,
  component: PageTree,
});
const pageTreeWorkspaceCache = new Map<string, PageTreeWorkspace>();

type Flat = PageNode & { depth: number; hasChildren: boolean; muted?: boolean };
type Filters = {
  status: "all" | "Published" | "Concept";
  validation: "all" | "problems";
  template: string;
};
type UrlImpact = {
  id: string;
  title: string;
  oldPath: string;
  newPath: string;
  published: boolean;
};
type PendingMove = {
  source: PageNode;
  destination: { id: string; position: PageDropPosition };
  impacts: UrlImpact[];
};
const defaultFilters: Filters = {
  status: "all",
  validation: "all",
  template: "all",
};

function flatten(
  nodes: PageNode[],
  expanded: Set<string>,
  muted: Set<string>,
  depth = 0,
): Flat[] {
  return nodes.flatMap((node) => [
    {
      ...node,
      depth,
      hasChildren: node.children.length > 0,
      muted: muted.has(node.id),
    },
    ...(expanded.has(node.id)
      ? flatten(node.children, expanded, muted, depth + 1)
      : []),
  ]);
}
function expandable(nodes: PageNode[]) {
  const ids = new Set<string>();
  const walk = (node: PageNode) => {
    if (node.children.length) ids.add(node.id);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return ids;
}
function ownSlug(path: string) {
  return path === "/" ? "/" : `/${path.split("/").filter(Boolean).at(-1)}`;
}
function filterTree(nodes: PageNode[], ownMatch: (node: PageNode) => boolean) {
  const muted = new Set<string>();
  const visit = (node: PageNode): PageNode | null => {
    const children = node.children.map(visit).filter(Boolean) as PageNode[];
    const matches = ownMatch(node);
    if (!matches && !children.length) return null;
    if (!matches) muted.add(node.id);
    return { ...node, children };
  };
  return { nodes: nodes.map(visit).filter(Boolean) as PageNode[], muted };
}
function findNode(nodes: PageNode[], id: string): PageNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNode(node.children, id);
    if (child) return child;
  }
  return null;
}
function containsNode(node: PageNode, id: string): boolean {
  return node.children.some(
    (child) => child.id === id || containsNode(child, id),
  );
}
function subtree(node: PageNode): PageNode[] {
  return [node, ...node.children.flatMap(subtree)];
}
function moveImpacts(
  pages: PageNode[],
  source: PageNode,
  destination: { id: string; position: PageDropPosition },
) {
  const target = findNode(pages, destination.id);
  if (!target) return [];
  const newParent =
    target.isHomepage || destination.position === "inside"
      ? target
      : target.parentId
        ? findNode(pages, target.parentId)
        : null;
  if (!newParent || newParent.id === source.parentId) return [];
  const segment = source.slug.split("/").filter(Boolean).at(-1);
  if (!segment) return [];
  const newRoot =
    newParent.slug === "/" ? `/${segment}` : `${newParent.slug}/${segment}`;
  return subtree(source)
    .map((page) => ({
      id: page.id,
      title: page.title,
      oldPath: page.slug,
      newPath: `${newRoot}${page.slug.slice(source.slug.length)}`,
      published: page.status === "Published",
    }))
    .filter((impact) => impact.oldPath !== impact.newPath);
}

function PageTree() {
  const navigate = useNavigate(),
    { user, loading: authLoading } = useAuth();
  const urlSearch = Route.useSearch();
  const cachedWorkspace = user
    ? (pageTreeWorkspaceCache.get(user.id) ?? null)
    : null;
  const [data, setData] = useState<PageTreeWorkspace | null>(cachedWorkspace),
    [loading, setLoading] = useState(!cachedWorkspace),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(new Set<string>()),
    [selected, setSelected] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(false),
    [selection, setSelection] = useState<{
      siteId?: string;
      languageId?: string;
    }>({}),
    [addParent, setAddParent] = useState<PageNode | null>(null),
    [addTitle, setAddTitle] = useState(""),
    [addSlug, setAddSlug] = useState(""),
    [addTemplate, setAddTemplate] = useState("Standard page"),
    [creating, setCreating] = useState(false),
    [actionPage, setActionPage] = useState<PageNode | null>(null),
    [renameTarget, setRenameTarget] = useState<PageNode | null>(null),
    [renameTitle, setRenameTitle] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<PageNode | null>(null),
    [mutating, setMutating] = useState(false),
    [modalError, setModalError] = useState(""),
    [dragId, setDragId] = useState(""),
    [dropTarget, setDropTarget] = useState<{
      id: string;
      position: PageDropPosition;
    } | null>(null),
    [moving, setMoving] = useState(false),
    [pendingMove, setPendingMove] = useState<PendingMove | null>(null),
    [createMoveRedirects, setCreateMoveRedirects] = useState(true),
    [toast, setToast] = useState<{
      title: string;
      detail: string;
    } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null),
    restored = useRef(false),
    expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    didDrag = useRef(false),
    dragIdRef = useRef(""),
    dropTargetRef = useRef<{
      id: string;
      position: PageDropPosition;
    } | null>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = urlSearch.q ?? "";
  const filters = useMemo<Filters>(
    () => ({
      status:
        urlSearch.status === "published"
          ? "Published"
          : urlSearch.status === "concept"
            ? "Concept"
            : "all",
      validation: urlSearch.validation ?? "all",
      template: urlSearch.template ?? "all",
    }),
    [urlSearch.status, urlSearch.template, urlSearch.validation],
  );
  const updateUrlView = (nextQuery: string, nextFilters: Filters) => {
    void navigate({
      to: "/",
      search: createPageTreeUrlSearch({
        q: nextQuery,
        ...nextFilters,
      }),
      replace: true,
      resetScroll: false,
    });
  };
  const setQuery = (value: string) => updateUrlView(value, filters);
  const setFilters = (value: Filters | ((current: Filters) => Filters)) => {
    const next = typeof value === "function" ? value(filters) : value;
    updateUrlView(query, next);
  };
  const load = async (nextSelection = selection) => {
    setLoading(true);
    setError("");
    try {
      const workspace = await loadPageTreeWorkspace(nextSelection);
      if (workspace && user?.id) pageTreeWorkspaceCache.set(user.id, workspace);
      setData(workspace);
      if (workspace) {
        setSelection({
          siteId: workspace.site.id,
          languageId: workspace.language.id,
        });
        const key = `sf-tree:${workspace.language.id}`,
          saved = sessionStorage.getItem(key);
        if (saved) {
          const state = JSON.parse(saved) as {
            expanded?: string[];
            selected?: string;
            scrollTop?: number;
          };
          setExpanded(new Set(state.expanded ?? []));
          setSelected(state.selected ?? "");
          requestAnimationFrame(() => {
            if (scrollRef.current)
              scrollRef.current.scrollTop = state.scrollTop ?? 0;
          });
        } else {
          setExpanded(expandable(workspace.pages));
          setSelected("");
        }
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load pages",
      );
    } finally {
      setLoading(false);
      restored.current = true;
    }
  };
  useEffect(() => {
    if (user) void load();
  }, [user?.id]);
  useEffect(() => {
    if (!data || !restored.current) return;
    const persist = () =>
      sessionStorage.setItem(
        `sf-tree:${data.language.id}`,
        JSON.stringify({
          expanded: [...expanded],
          selected,
          scrollTop: scrollRef.current?.scrollTop ?? 0,
        }),
      );
    persist();
    const element = scrollRef.current;
    element?.addEventListener("scroll", persist, { passive: true });
    return () => element?.removeEventListener("scroll", persist);
  }, [data, expanded, selected]);
  const templates = useMemo(
    () =>
      data
        ? [
            ...new Set([
              "Standard page",
              "Landing page",
              "News article",
              "Blog article",
              ...flatten(data.pages, expandable(data.pages), new Set()).map(
                (page) => page.template,
              ),
            ]),
          ].sort()
        : [],
    [data],
  );
  const filtering =
    Boolean(query.trim()) ||
    filters.status !== "all" ||
    filters.validation !== "all" ||
    filters.template !== "all";
  const filtered = useMemo(
    () =>
      data
        ? filterTree(data.pages, (page) => {
            const text =
              `${page.title} ${page.slug} ${page.template}`.toLowerCase();
            return (
              (!query.trim() || text.includes(query.toLowerCase())) &&
              (filters.status === "all" || page.status === filters.status) &&
              (filters.validation === "all" ||
                page.validation === "Needs attention") &&
              (filters.template === "all" || page.template === filters.template)
            );
          })
        : { nodes: [], muted: new Set<string>() },
    [data, query, filters],
  );
  const visibleExpanded = filtering ? expandable(filtered.nodes) : expanded;
  const expandableIds = useMemo(
    () => (data ? expandable(data.pages) : new Set<string>()),
    [data],
  );
  const allExpanded =
    expandableIds.size > 0 &&
    [...expandableIds].every((pageId) => expanded.has(pageId));
  const rows = useMemo(
    () => flatten(filtered.nodes, visibleExpanded, filtered.muted),
    [filtered, visibleExpanded],
  );
  const openAdd = (parent?: PageNode | null) => {
    const fallback = parent ?? data?.pages[0] ?? null;
    if (!fallback) return;
    setAddParent(fallback);
    setAddTitle("");
    setAddSlug("");
    setAddTemplate(fallback.preferredChildTemplate || "Standard page");
  };
  const create = async () => {
    if (!data || !addParent || !addTitle.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createChildPage({
        languageId: data.language.id,
        parentId: addParent.id,
        title: addTitle,
        slug: addSlug,
        template: addTemplate,
      });
      setAddParent(null);
      await load(selection);
      void navigate({ to: "/editor", search: { page: id } });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create page",
      );
    } finally {
      setCreating(false);
    }
  };
  const switchWorkspace = (workspace: WorkspaceOption) => {
    restored.current = false;
    const next = { siteId: workspace.siteId, languageId: workspace.languageId };
    setSelection(next);
    void load(next);
  };
  const showToast = (title: string, detail: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title, detail });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };
  const clearDrag = () => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
    expandTimer.current = null;
    dragIdRef.current = "";
    dropTargetRef.current = null;
    setDragId("");
    setDropTarget(null);
    setTimeout(() => {
      didDrag.current = false;
    }, 0);
  };
  const dragOver = (event: DragEvent<HTMLDivElement>, target: PageNode) => {
    const sourceId = dragIdRef.current;
    if (!data || !sourceId || sourceId === target.id) return;
    const source = findNode(data.pages, sourceId);
    if (!source || containsNode(source, target.id)) {
      dropTargetRef.current = null;
      setDropTarget(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect(),
      offset = event.clientY - rect.top;
    let position: PageDropPosition =
      offset < rect.height * 0.3
        ? "before"
        : offset > rect.height * 0.7
          ? "after"
          : "inside";
    if (target.isHomepage) position = "inside";
    dropTargetRef.current = { id: target.id, position };
    setDropTarget((current) =>
      current?.id === target.id && current.position === position
        ? current
        : { id: target.id, position },
    );
    if (
      position === "inside" &&
      target.children.length &&
      !expanded.has(target.id) &&
      !expandTimer.current
    ) {
      expandTimer.current = setTimeout(() => {
        setExpanded((current) => new Set(current).add(target.id));
        expandTimer.current = null;
      }, 550);
    } else if (position !== "inside" && expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  };
  const drop = async (event: DragEvent<HTMLDivElement>, target: PageNode) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceId =
        dragIdRef.current || event.dataTransfer.getData("text/plain"),
      destination = dropTargetRef.current ?? dropTarget;
    clearDrag();
    if (
      !data ||
      !sourceId ||
      !destination ||
      destination.id !== target.id ||
      moving
    )
      return;
    const source = findNode(data.pages, sourceId);
    if (!source) return;
    const impacts = moveImpacts(data.pages, source, destination);
    if (impacts.some((impact) => impact.id !== source.id)) {
      setCreateMoveRedirects(true);
      setModalError("");
      setPendingMove({ source, destination, impacts });
      return;
    }
    await commitMove(source, destination, false);
  };
  const commitMove = async (
    source: PageNode,
    destination: { id: string; position: PageDropPosition },
    createRedirects: boolean,
  ) => {
    setMoving(true);
    setError("");
    try {
      const result = await movePage({
        pageId: source.id,
        targetId: destination.id,
        position: destination.position,
        createRedirects,
      });
      await load(selection);
      setSelected(source.id);
      if (destination.position === "inside")
        setExpanded((current) => new Set(current).add(destination.id));
      showToast(
        result.reparented
          ? `Moved “${source.title}” under “${result.parentTitle}”`
          : `Reordered “${source.title}”`,
        result.reparented
          ? `${result.affectedPages} URL${result.affectedPages === 1 ? "" : "s"} updated${result.redirectsCreated ? ` · ${result.redirectsCreated} redirect${result.redirectsCreated === 1 ? "" : "s"} created` : ""}`
          : "Sibling order saved.",
      );
      return true;
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "The move was not saved.";
      if (pendingMove) setModalError(message);
      showToast("Could not move page", message);
      return false;
    } finally {
      setMoving(false);
    }
  };
  const rename = async () => {
    if (!renameTarget || !renameTitle.trim() || mutating) return;
    setMutating(true);
    setModalError("");
    try {
      await renamePage(renameTarget.id, renameTitle);
      setRenameTarget(null);
      await load(selection);
    } catch (reason) {
      setModalError(
        reason instanceof Error ? reason.message : "Could not rename page",
      );
    } finally {
      setMutating(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget || mutating) return;
    setMutating(true);
    setModalError("");
    try {
      await deletePage(deleteTarget.id);
      setDeleteTarget(null);
      setSelected((value) => (value === deleteTarget.id ? "" : value));
      await load(selection);
    } catch (reason) {
      setModalError(
        reason instanceof Error ? reason.message : "Could not delete page",
      );
    } finally {
      setMutating(false);
    }
  };
  if (authLoading || !user)
    return <div className="sf-loading">Loading your page tree...</div>;
  if (loading && !data)
    return (
      <AppShell active="pages">
        <div className="sf-route-loading" role="status">
          <span className="sf-route-loading-mark">
            <i className="ph ph-tree-structure" />
          </span>
          <strong>Loading your page tree</strong>
          <small>The navigation stays put while your pages arrive.</small>
        </div>
      </AppShell>
    );
  return (
    <AppShell
      active="pages"
      siteName={data?.site.name}
      languageName={data?.language.name}
      languageCode={data?.language.code}
      pageCount={data?.pageCount}
      workspaces={data?.workspaces}
      onWorkspaceSelect={switchWorkspace}
    >
      <header className="sf-tree-head">
        <div className="sf-tree-title">
          <div>
            <h1>Pages</h1>
            <b>{data?.pageCount ?? 0} pages</b>
          </div>
          <span>
            Canonical page tree · {data?.language.name ?? "English"} ·{" "}
            {(data?.language.code ?? "en").toUpperCase()}
          </span>
        </div>
        <span className="sf-spacer" />
        <label className="sf-search">
          <i className="ph ph-magnifying-glass" />
          <input
            aria-label="Search pages"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages..."
            value={query}
          />
        </label>
        <button
          className={`sf-action ${filtersOpen || filtering ? "active" : ""}`}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <i className="ph ph-funnel" />
          Filters
          {filtering ? (
            <b className="sf-filter-count">
              {
                [
                  query,
                  filters.status !== "all",
                  filters.validation !== "all",
                  filters.template !== "all",
                ].filter(Boolean).length
              }
            </b>
          ) : null}
        </button>
        <button
          className="sf-action"
          disabled={filtering || expandableIds.size === 0}
          onClick={() =>
            setExpanded(allExpanded ? new Set() : new Set(expandableIds))
          }
          title={
            filtering
              ? "Clear search and filters to change the tree expansion"
              : undefined
          }
        >
          <i className={`ph ph-caret-double-${allExpanded ? "up" : "down"}`} />
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
        <button className="sf-action primary" onClick={() => openAdd()}>
          <i className="ph-bold ph-plus" />
          Add page
        </button>
      </header>
      {filtering && (
        <div className="sf-active-filters" aria-label="Active filters">
          <span>Active filters</span>
          {query.trim() ? (
            <button onClick={() => setQuery("")}>
              Search: “{query.trim()}” <i className="ph ph-x" />
            </button>
          ) : null}
          {filters.status !== "all" ? (
            <button
              onClick={() =>
                setFilters((value) => ({ ...value, status: "all" }))
              }
            >
              Status: {filters.status} <i className="ph ph-x" />
            </button>
          ) : null}
          {filters.template !== "all" ? (
            <button
              onClick={() =>
                setFilters((value) => ({ ...value, template: "all" }))
              }
            >
              Template: {filters.template} <i className="ph ph-x" />
            </button>
          ) : null}
          {filters.validation !== "all" ? (
            <button
              onClick={() =>
                setFilters((value) => ({ ...value, validation: "all" }))
              }
            >
              Validation: Needs attention <i className="ph ph-x" />
            </button>
          ) : null}
          <button
            className="sf-reset-filters"
            onClick={() => updateUrlView("", defaultFilters)}
          >
            Reset all
          </button>
        </div>
      )}
      {filtersOpen && (
        <div className="sf-filter-bar">
          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  status: event.target.value as Filters["status"],
                }))
              }
            >
              <option value="all">All statuses</option>
              <option>Published</option>
              <option>Concept</option>
            </select>
          </label>
          <label>
            <span>Template</span>
            <select
              value={filters.template}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  template: event.target.value,
                }))
              }
            >
              <option value="all">All templates</option>
              {templates.map((template) => (
                <option key={template}>{template}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Validation</span>
            <select
              value={filters.validation}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  validation: event.target.value as Filters["validation"],
                }))
              }
            >
              <option value="all">All pages</option>
              <option value="problems">Needs attention</option>
            </select>
          </label>
          {filtering && (
            <button onClick={() => updateUrlView("", defaultFilters)}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <div className="sf-tree-scroll sf-scroll" ref={scrollRef}>
        {error ? (
          <div className="sf-loading" style={{ width: "100%", height: "100%" }}>
            {error}
          </div>
        ) : rows.length ? (
          rows.map((page) => (
            <div
              className={`sf-tree-row${selected === page.id ? " selected" : ""}${page.muted ? " muted" : ""}${actionPage?.id === page.id ? " menu-open" : ""}${dragId === page.id ? " dragging" : ""}${dropTarget?.id === page.id ? ` drop-${dropTarget.position}` : ""}`}
              draggable={!page.isHomepage && !moving}
              key={page.id}
              onClick={() => {
                if (didDrag.current) return;
                setSelected(page.id);
                void navigate({ to: "/editor", search: { page: page.id } });
              }}
              onDragStart={(event) => {
                if (page.isHomepage || moving) {
                  event.preventDefault();
                  return;
                }
                didDrag.current = true;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", page.id);
                dragIdRef.current = page.id;
                setActionPage(null);
                setSelected(page.id);
                setDragId(page.id);
              }}
              onDragOver={(event) => dragOver(event, page)}
              onDrop={(event) => void drop(event, page)}
              onDragEnd={clearDrag}
              style={
                {
                  paddingLeft: 14 + page.depth * 24,
                  "--drop-indent": `${14 + page.depth * 24}px`,
                } as CSSProperties
              }
            >
              <button
                className={`sf-tree-chevron${page.hasChildren ? "" : " hidden"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((current) => {
                    const next = new Set(current);
                    next.has(page.id)
                      ? next.delete(page.id)
                      : next.add(page.id);
                    return next;
                  });
                }}
              >
                <i
                  className={`ph-bold ph-caret-${visibleExpanded.has(page.id) ? "down" : "right"}`}
                />
              </button>
              <span className="sf-tree-icon">
                <i
                  className={`ph ${page.depth === 0 ? "ph-house" : page.hasChildren ? "ph-folder" : "ph-file-text"}`}
                />
              </span>
              <span className="sf-tree-name">{page.title}</span>
              <span className="sf-tree-slug">{ownSlug(page.slug)}</span>
              <span className="sf-spacer" />
              <span className="sf-template">{page.template}</span>
              <StatusPill status={page.status} />
              {page.validation === "Needs attention" ? (
                <span className="sf-validation-badge" title="Needs attention">
                  <i className="ph-fill ph-warning" />1
                </span>
              ) : null}
              <button
                aria-label={`Add under ${page.title}`}
                className="sf-row-icon"
                onClick={(event) => {
                  event.stopPropagation();
                  openAdd(page);
                }}
              >
                <i className="ph-bold ph-plus" />
              </button>
              <button
                aria-label={`More actions for ${page.title}`}
                className={`sf-row-icon${actionPage?.id === page.id ? " active" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActionPage((current) =>
                    current?.id === page.id ? null : page,
                  );
                }}
              >
                <i className="ph-bold ph-dots-three" />
              </button>
              {actionPage?.id === page.id ? (
                <div
                  className="sf-row-menu"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    onClick={() =>
                      void navigate({
                        to: "/editor",
                        search: { page: page.id },
                      })
                    }
                  >
                    <i className="ph ph-pencil-simple" /> Edit page
                  </button>
                  <button
                    onClick={() => {
                      setActionPage(null);
                      openAdd(page);
                    }}
                  >
                    <i className="ph ph-plus" /> Add child page
                  </button>
                  <button
                    onClick={() => {
                      setActionPage(null);
                      setModalError("");
                      setRenameTarget(page);
                      setRenameTitle(page.title);
                    }}
                  >
                    <i className="ph ph-text-t" /> Rename title
                  </button>
                  <button
                    className="danger"
                    disabled={page.isHomepage || page.hasChildren}
                    title={
                      page.isHomepage
                        ? "The homepage cannot be deleted"
                        : page.hasChildren
                          ? "Move or delete child pages first"
                          : undefined
                    }
                    onClick={() => {
                      setActionPage(null);
                      setModalError("");
                      setDeleteTarget(page);
                    }}
                  >
                    <i className="ph ph-trash" /> Delete page
                  </button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="sf-tree-empty">
            <i className="ph ph-magnifying-glass" />
            <strong>No pages found</strong>
            <span>Try a different search or clear your filters.</span>
            <button onClick={() => updateUrlView("", defaultFilters)}>
              Clear filters
            </button>
          </div>
        )}
      </div>
      <footer className="sf-tree-foot">
        <i className="ph ph-arrows-out-cardinal" />
        Drag a row to reorder, or onto another page to reparent
        <span className="sf-spacer" />
        <span className="sf-mono">
          {rows.filter((row) => !row.muted).length} matching · {rows.length}{" "}
          shown
        </span>
      </footer>
      <Modal
        open={Boolean(addParent)}
        onOpenChange={(open) => !open && !creating && setAddParent(null)}
      >
        {addParent ? (
          <>
            <header>
              <div>
                <ModalTitle>Add page</ModalTitle>
                <ModalDescription>
                  Under {addParent.title} · {addParent.slug}
                </ModalDescription>
              </div>
              <ModalClose disabled={creating}>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body">
              <label>
                <span>Page title</span>
                <input
                  autoFocus
                  value={addTitle}
                  onChange={(event) => setAddTitle(event.target.value)}
                  placeholder="Untitled page"
                />
              </label>
              <label>
                <span>URL slug</span>
                <div className="sf-add-slug">
                  <b>{addParent.slug === "/" ? "/" : `${addParent.slug}/`}</b>
                  <input
                    value={addSlug}
                    onChange={(event) => setAddSlug(event.target.value)}
                    placeholder="generated-from-title"
                  />
                </div>
              </label>
              <label>
                <span>Starting template</span>
                <select
                  value={addTemplate}
                  onChange={(event) => setAddTemplate(event.target.value)}
                >
                  {addParent.preferredChildTemplate ? (
                    <option>{addParent.preferredChildTemplate}</option>
                  ) : null}
                  {templates
                    .filter(
                      (template) =>
                        template !== addParent.preferredChildTemplate,
                    )
                    .map((template) => (
                      <option key={template}>{template}</option>
                    ))}
                </select>
                <small>
                  Templates provide starting content only. The page remains
                  fully editable.
                </small>
              </label>
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={creating}>
                Cancel
              </ModalClose>
              <button
                className="sf-action primary"
                disabled={!addTitle.trim() || creating}
                onClick={() => void create()}
              >
                {creating ? "Creating..." : "Create page"}
              </button>
            </footer>
          </>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && !mutating && setRenameTarget(null)}
      >
        {renameTarget ? (
          <>
            <header>
              <div>
                <ModalTitle>Rename page</ModalTitle>
                <ModalDescription>The URL will not change</ModalDescription>
              </div>
              <ModalClose disabled={mutating}>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body">
              <label>
                <span>Page title</span>
                <input
                  autoFocus
                  value={renameTitle}
                  onChange={(event) => setRenameTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void rename()}
                />
              </label>
              {modalError ? (
                <p className="sf-modal-error">{modalError}</p>
              ) : null}
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={mutating}>
                Cancel
              </ModalClose>
              <button
                className="sf-action primary"
                disabled={!renameTitle.trim() || mutating}
                onClick={() => void rename()}
              >
                {mutating ? "Saving..." : "Save title"}
              </button>
            </footer>
          </>
        ) : null}
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && !mutating && setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <>
            <header>
              <div>
                <ModalTitle>Delete page?</ModalTitle>
                <ModalDescription>{deleteTarget.slug}</ModalDescription>
              </div>
              <ModalClose disabled={mutating}>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body">
              <p className="sf-delete-copy">
                <strong>{deleteTarget.title}</strong> will be permanently
                deleted. This cannot be undone.
              </p>
              {modalError ? (
                <p className="sf-modal-error">{modalError}</p>
              ) : null}
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={mutating}>
                Cancel
              </ModalClose>
              <button
                className="sf-action danger"
                disabled={mutating}
                onClick={() => void remove()}
              >
                {mutating ? "Deleting..." : "Delete page"}
              </button>
            </footer>
          </>
        ) : null}
      </Modal>
      <Modal
        className="sf-impact-modal"
        open={Boolean(pendingMove)}
        onOpenChange={(open) => !open && !moving && setPendingMove(null)}
      >
        {pendingMove ? (
          <>
            <header>
              <div>
                <ModalTitle>Review URL changes</ModalTitle>
                <ModalDescription>
                  Moving {pendingMove.source.title} also changes descendant URLs
                </ModalDescription>
              </div>
              <ModalClose disabled={moving}>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body">
              <div className="sf-impact-summary">
                <i className="ph ph-warning-circle" />
                <span>
                  <strong>
                    {pendingMove.impacts.length} URLs will change.
                  </strong>
                  Review the old and proposed addresses before continuing.
                </span>
              </div>
              <div className="sf-impact-list sf-scroll">
                {pendingMove.impacts.map((impact) => (
                  <div className="sf-impact-row" key={impact.id}>
                    <div>
                      <strong>{impact.title}</strong>
                      {impact.published ? (
                        <span>Published</span>
                      ) : (
                        <span>Concept</span>
                      )}
                    </div>
                    <code>{impact.oldPath}</code>
                    <i className="ph ph-arrow-right" />
                    <code>{impact.newPath}</code>
                  </div>
                ))}
              </div>
              <label className="sf-redirect-choice">
                <input
                  type="checkbox"
                  checked={createMoveRedirects}
                  disabled={!pendingMove.impacts.some((item) => item.published)}
                  onChange={(event) =>
                    setCreateMoveRedirects(event.target.checked)
                  }
                />
                <span>
                  <strong>Create redirects from published URLs</strong>
                  {
                    pendingMove.impacts.filter((item) => item.published).length
                  }{" "}
                  old published URL
                  {pendingMove.impacts.filter((item) => item.published)
                    .length === 1
                    ? ""
                    : "s"}{" "}
                  will continue to work.
                </span>
              </label>
              {modalError ? (
                <p className="sf-modal-error">{modalError}</p>
              ) : null}
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={moving}>
                Cancel move
              </ModalClose>
              <button
                className="sf-action primary"
                disabled={moving}
                onClick={() => {
                  const move = pendingMove;
                  setModalError("");
                  void (async () => {
                    const moved = await commitMove(
                      move.source,
                      move.destination,
                      createMoveRedirects,
                    );
                    if (moved) setPendingMove(null);
                  })();
                }}
              >
                {moving ? "Moving..." : "Confirm move"}
              </button>
            </footer>
          </>
        ) : null}
      </Modal>
      {toast ? (
        <div className="sf-tree-toast" role="status">
          <i className="ph ph-arrows-out-cardinal" />
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <i className="ph ph-x" />
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
