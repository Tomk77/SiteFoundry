import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type CSSProperties,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppShell, StatusPill } from "../components/app-shell";
import { AppShellSkeleton, LoadingSplash } from "../components/loading";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "../components/modal";
import { useAuth } from "../lib/auth";
import {
  slugifyTemplateKey,
  templateComponentSummary,
  validatePageTemplate,
  type PageTemplateDefinition,
} from "../lib/page-templates";
import { loadPageTemplates } from "../lib/page-templates-data";
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
import { createPageTreeUrlSearch, parsePageTreeUrlSearch } from "../lib/url-view-state";
import "../overview.css";

export const Route = createFileRoute("/")({
  validateSearch: parsePageTreeUrlSearch,
  component: PageTree,
});
const pageTreeWorkspaceCache = new Map<string, PageTreeWorkspace>();

type Flat = PageNode & { depth: number; hasChildren: boolean; muted?: boolean };
interface Filters {
  status: "all" | "Published" | "Concept";
  validation: "all" | "problems";
  template: string;
}
interface UrlImpact {
  id: string;
  title: string;
  oldPath: string;
  newPath: string;
  published: boolean;
}
interface PendingMove {
  source: PageNode;
  destination: { id: string; position: PageDropPosition };
  impacts: UrlImpact[];
}
const defaultFilters: Filters = {
  status: "all",
  validation: "all",
  template: "all",
};

function flatten(nodes: PageNode[], expanded: Set<string>, muted: Set<string>, depth = 0): Flat[] {
  return nodes.flatMap((node) => [
    {
      ...node,
      depth,
      hasChildren: node.children.length > 0,
      muted: muted.has(node.id),
    },
    ...(expanded.has(node.id) ? flatten(node.children, expanded, muted, depth + 1) : []),
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
  return node.children.some((child) => child.id === id || containsNode(child, id));
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
  const newRoot = newParent.slug === "/" ? `/${segment}` : `${newParent.slug}/${segment}`;
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
  const cachedWorkspace = user ? (pageTreeWorkspaceCache.get(user.id) ?? null) : null;
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
    [addQuickParent, setAddQuickParent] = useState<PageNode | null>(null),
    [addTitle, setAddTitle] = useState(""),
    [addSlug, setAddSlug] = useState(""),
    [addSlugEdited, setAddSlugEdited] = useState(false),
    [addTemplateKey, setAddTemplateKey] = useState(""),
    [pageTemplates, setPageTemplates] = useState<PageTemplateDefinition[]>([]),
    [templateLoadError, setTemplateLoadError] = useState(""),
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
        try {
          setPageTemplates(await loadPageTemplates(workspace.language.id));
          setTemplateLoadError("");
        } catch (templateError) {
          setPageTemplates([]);
          setTemplateLoadError(
            templateError instanceof Error ? templateError.message : "Could not load templates.",
          );
        }
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
            if (scrollRef.current) scrollRef.current.scrollTop = state.scrollTop ?? 0;
          });
        } else {
          setExpanded(expandable(workspace.pages));
          setSelected("");
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load pages");
    } finally {
      setLoading(false);
      restored.current = true;
    }
  };
  useEffect(() => {
    if (user) void load();
    // The loader intentionally uses the initial workspace selection for each signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [authLoading, navigate, user]);
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
  const templatesById = useMemo(
    () =>
      new Map(
        pageTemplates.flatMap((template) =>
          template.id ? [[template.id, template] as const] : [],
        ),
      ),
    [pageTemplates],
  );
  const templatesByKey = useMemo(
    () => new Map(pageTemplates.map((template) => [template.key, template])),
    [pageTemplates],
  );
  const templateForPage = useCallback(
    (page: PageNode) =>
      (page.templateId ? templatesById.get(page.templateId) : undefined) ??
      (page.templateKey ? templatesByKey.get(page.templateKey) : undefined) ??
      pageTemplates.find((template) => template.name === page.template),
    [pageTemplates, templatesById, templatesByKey],
  );
  const filterTemplates = useMemo(
    () => [...pageTemplates].sort((first, second) => first.name.localeCompare(second.name)),
    [pageTemplates],
  );
  const activeFilterTemplate =
    templatesByKey.get(filters.template) ??
    pageTemplates.find((template) => template.name === filters.template);
  const filtering =
    Boolean(query.trim()) ||
    filters.status !== "all" ||
    filters.validation !== "all" ||
    filters.template !== "all";
  const filtered = useMemo(
    () =>
      data
        ? filterTree(data.pages, (page) => {
            const resolvedTemplate = templateForPage(page);
            const text =
              `${page.title} ${page.slug} ${resolvedTemplate?.name ?? page.template} ${resolvedTemplate?.key ?? page.templateKey ?? ""}`.toLowerCase();
            return (
              (!query.trim() || text.includes(query.toLowerCase())) &&
              (filters.status === "all" || page.status === filters.status) &&
              (filters.validation === "all" || page.validation === "Needs attention") &&
              (filters.template === "all" ||
                (activeFilterTemplate
                  ? page.templateId === activeFilterTemplate.id ||
                    page.templateKey === activeFilterTemplate.key ||
                    page.template === activeFilterTemplate.name
                  : page.template === filters.template || page.templateKey === filters.template))
            );
          })
        : { nodes: [], muted: new Set<string>() },
    [activeFilterTemplate, data, filters, query, templateForPage],
  );
  const visibleExpanded = filtering ? expandable(filtered.nodes) : expanded;
  const expandableIds = useMemo(() => (data ? expandable(data.pages) : new Set<string>()), [data]);
  const allExpanded =
    expandableIds.size > 0 && [...expandableIds].every((pageId) => expanded.has(pageId));
  const rows = useMemo(
    () => flatten(filtered.nodes, visibleExpanded, filtered.muted),
    [filtered, visibleExpanded],
  );
  const preferredTemplateFor = (parent: PageNode) => {
    const preferred = parent.preferredChildTemplate;
    const available = pageTemplates.filter(
      (template) => template.status === "published" && !validatePageTemplate(template).length,
    );
    return (
      available.find((template) => template.key === preferred || template.name === preferred) ??
      available.find((template) => template.fallback) ??
      available[0]
    );
  };
  const openAdd = (parent?: PageNode | null, templateKey?: string) => {
    const fallback = parent ?? data?.pages[0] ?? null;
    if (!fallback) return;
    setAddParent(fallback);
    setAddQuickParent(null);
    setAddTitle("");
    setAddSlug("");
    setAddSlugEdited(false);
    setAddTemplateKey(templateKey || preferredTemplateFor(fallback)?.key || "");
  };
  const selectedAddTemplate = pageTemplates.find((template) => template.key === addTemplateKey);
  const addTemplateIssues = selectedAddTemplate ? validatePageTemplate(selectedAddTemplate) : [];
  const normalizedAddSlug = slugifyTemplateKey(addSlug || addTitle) || "untitled-page";
  const slugCollision = Boolean(
    addParent?.children.some(
      (child) => child.slug.split("/").filter(Boolean).at(-1) === normalizedAddSlug,
    ),
  );
  const create = async () => {
    if (
      !data ||
      !addParent ||
      !addTitle.trim() ||
      !selectedAddTemplate ||
      addTemplateIssues.length ||
      slugCollision ||
      creating
    )
      return;
    setCreating(true);
    try {
      const id = await createChildPage({
        languageId: data.language.id,
        parentId: addParent.id,
        title: addTitle,
        slug: addSlug,
        template: selectedAddTemplate,
      });
      setAddParent(null);
      await load(selection);
      void navigate({ to: "/editor", search: { page: id } });
    } catch (reason) {
      setModalError(reason instanceof Error ? reason.message : "Could not create page");
    } finally {
      setCreating(false);
    }
  };
  const quickCreate = async (parent: PageNode) => {
    const template = preferredTemplateFor(parent);
    if (!data || !template || validatePageTemplate(template).length || creating) {
      openAdd(parent, template?.key);
      return;
    }
    const baseTitle = `Untitled ${template.name.toLowerCase()}`;
    const occupiedSlugs = new Set(
      parent.children.map((child) => child.slug.split("/").filter(Boolean).at(-1)),
    );
    const baseSlug = slugifyTemplateKey(baseTitle);
    let slug = baseSlug;
    let suffix = 2;
    while (occupiedSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const title = slug === baseSlug ? baseTitle : `${baseTitle} ${suffix - 1}`;
    setCreating(true);
    setAddQuickParent(null);
    try {
      const id = await createChildPage({
        languageId: data.language.id,
        parentId: parent.id,
        title,
        slug,
        template,
      });
      await load(selection);
      showToast("Page created", `${title} saved as a concept.`);
      void navigate({ to: "/editor", search: { page: id } });
    } catch (reason) {
      showToast(
        "Could not create page",
        reason instanceof Error ? reason.message : "Try the full page dialog.",
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
      offset < rect.height * 0.3 ? "before" : offset > rect.height * 0.7 ? "after" : "inside";
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
    const sourceId = dragIdRef.current || event.dataTransfer.getData("text/plain"),
      destination = dropTargetRef.current ?? dropTarget;
    clearDrag();
    if (!data || !sourceId || !destination || destination.id !== target.id || moving) return;
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
      const message = reason instanceof Error ? reason.message : "The move was not saved.";
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
      setModalError(reason instanceof Error ? reason.message : "Could not rename page");
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
      setModalError(reason instanceof Error ? reason.message : "Could not delete page");
    } finally {
      setMutating(false);
    }
  };
  if (authLoading || !user) return <LoadingSplash />;
  if (loading && !data) return <AppShellSkeleton label="Loading your page tree" variant="tree" />;
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
        <label className="sf-search" htmlFor="page-search">
          <i className="ph ph-magnifying-glass" />
          <Input
            unstyled
            id="page-search"
            aria-label="Search pages"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages..."
            value={query}
          />
        </label>
        <Button
          unstyled
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
        </Button>
        <Button
          unstyled
          className="sf-action"
          disabled={filtering || expandableIds.size === 0}
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(expandableIds))}
          title={filtering ? "Clear search and filters to change the tree expansion" : undefined}
        >
          <i className={`ph ph-caret-double-${allExpanded ? "up" : "down"}`} />
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
        <Button unstyled className="sf-action primary" onClick={() => openAdd()}>
          <i className="ph-bold ph-plus" />
          Add page
        </Button>
      </header>
      {filtering && (
        <div className="sf-active-filters" aria-label="Active filters">
          <span>Active filters</span>
          {query.trim() ? (
            <Button unstyled onClick={() => setQuery("")}>
              Search: “{query.trim()}” <i className="ph ph-x" />
            </Button>
          ) : null}
          {filters.status !== "all" ? (
            <Button unstyled onClick={() => setFilters((value) => ({ ...value, status: "all" }))}>
              Status: {filters.status} <i className="ph ph-x" />
            </Button>
          ) : null}
          {filters.template !== "all" ? (
            <Button unstyled onClick={() => setFilters((value) => ({ ...value, template: "all" }))}>
              Template: {activeFilterTemplate?.name ?? filters.template} <i className="ph ph-x" />
            </Button>
          ) : null}
          {filters.validation !== "all" ? (
            <Button
              unstyled
              onClick={() => setFilters((value) => ({ ...value, validation: "all" }))}
            >
              Validation: Needs attention <i className="ph ph-x" />
            </Button>
          ) : null}
          <Button
            unstyled
            className="sf-reset-filters"
            onClick={() => updateUrlView("", defaultFilters)}
          >
            Reset all
          </Button>
        </div>
      )}
      {filtersOpen && (
        <div className="sf-filter-bar">
          <label htmlFor="page-status-filter">
            <span>Status</span>
            <NativeSelect
              unstyled
              id="page-status-filter"
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
            </NativeSelect>
          </label>
          <label htmlFor="page-template-filter">
            <span>Template</span>
            <NativeSelect
              unstyled
              id="page-template-filter"
              value={activeFilterTemplate?.key ?? filters.template}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  template: event.target.value,
                }))
              }
            >
              <option value="all">All templates</option>
              {filterTemplates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label htmlFor="page-validation-filter">
            <span>Validation</span>
            <NativeSelect
              unstyled
              id="page-validation-filter"
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
            </NativeSelect>
          </label>
          {filtering && (
            <Button unstyled onClick={() => updateUrlView("", defaultFilters)}>
              Clear filters
            </Button>
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
              aria-level={page.depth + 1}
              aria-selected={selected === page.id}
              className={`sf-tree-row${selected === page.id ? " selected" : ""}${page.muted ? " muted" : ""}${actionPage?.id === page.id ? " menu-open" : ""}${dragId === page.id ? " dragging" : ""}${dropTarget?.id === page.id ? ` drop-${dropTarget.position}` : ""}`}
              draggable={!page.isHomepage && !moving}
              key={page.id}
              onClick={() => {
                if (didDrag.current) return;
                setSelected(page.id);
                void navigate({ to: "/editor", search: { page: page.id } });
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setSelected(page.id);
                void navigate({ to: "/editor", search: { page: page.id } });
              }}
              role="treeitem"
              tabIndex={0}
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
              <Button
                unstyled
                className={`sf-tree-chevron${page.hasChildren ? "" : " hidden"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(page.id)) next.delete(page.id);
                    else next.add(page.id);
                    return next;
                  });
                }}
              >
                <i
                  className={`ph-bold ph-caret-${visibleExpanded.has(page.id) ? "down" : "right"}`}
                />
              </Button>
              <span className="sf-tree-icon">
                <i
                  className={`ph ${page.depth === 0 ? "ph-house" : page.hasChildren ? "ph-folder" : "ph-file-text"}`}
                />
              </span>
              <span className="sf-tree-name">{page.title}</span>
              <span className="sf-tree-slug">{ownSlug(page.slug)}</span>
              <span className="sf-spacer" />
              <span className="sf-template">{templateForPage(page)?.name ?? page.template}</span>
              <StatusPill status={page.status} />
              {page.validation === "Needs attention" ? (
                <span className="sf-validation-badge" title="Needs attention">
                  <i className="ph-fill ph-warning" />1
                </span>
              ) : null}
              <Button
                unstyled
                aria-label={`Add under ${page.title}`}
                className="sf-row-icon"
                onClick={(event) => {
                  event.stopPropagation();
                  setAddQuickParent((current) => (current?.id === page.id ? null : page));
                }}
              >
                <i className="ph-bold ph-plus" />
              </Button>
              {addQuickParent?.id === page.id ? (
                <div
                  className="sf-add-page-quick-menu"
                  onClick={(event) => event.stopPropagation()}
                  role="presentation"
                >
                  <Button unstyled disabled={creating} onClick={() => void quickCreate(page)}>
                    <i className="ph ph-file-plus" />
                    <span>
                      <strong>Add {preferredTemplateFor(page)?.name ?? "page"}</strong>
                      <small>
                        {page.preferredChildTemplate
                          ? "Preferred template here"
                          : "Site fallback template"}
                      </small>
                    </span>
                  </Button>
                  <Button unstyled onClick={() => openAdd(page)}>
                    <i className="ph ph-stack" />
                    <span>
                      <strong>Add different kind of page...</strong>
                      <small>Choose from all templates</small>
                    </span>
                  </Button>
                </div>
              ) : null}
              <Button
                unstyled
                aria-label={`More actions for ${page.title}`}
                className={`sf-row-icon${actionPage?.id === page.id ? " active" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActionPage((current) => (current?.id === page.id ? null : page));
                }}
              >
                <i className="ph-bold ph-dots-three" />
              </Button>
              {actionPage?.id === page.id ? (
                <div
                  className="sf-row-menu"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  role="presentation"
                >
                  <Button
                    unstyled
                    onClick={() =>
                      void navigate({
                        to: "/editor",
                        search: { page: page.id },
                      })
                    }
                  >
                    <i className="ph ph-pencil-simple" /> Edit page
                  </Button>
                  <Button
                    unstyled
                    onClick={() => {
                      setActionPage(null);
                      openAdd(page);
                    }}
                  >
                    <i className="ph ph-plus" /> Add child page
                  </Button>
                  <Button
                    unstyled
                    onClick={() => {
                      setActionPage(null);
                      setModalError("");
                      setRenameTarget(page);
                      setRenameTitle(page.title);
                    }}
                  >
                    <i className="ph ph-text-t" /> Rename title
                  </Button>
                  <Button
                    unstyled
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
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="sf-tree-empty">
            <i className="ph ph-magnifying-glass" />
            <strong>No pages found</strong>
            <span>Try a different search or clear your filters.</span>
            <Button unstyled onClick={() => updateUrlView("", defaultFilters)}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
      <footer className="sf-tree-foot">
        <i className="ph ph-arrows-out-cardinal" />
        Drag a row to reorder, or onto another page to reparent
        <span className="sf-spacer" />
        <span className="sf-mono">
          {rows.filter((row) => !row.muted).length} matching · {rows.length} shown
        </span>
      </footer>
      <Modal
        className="sf-create-page-modal"
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
            <div className="sf-overview-modal-body sf-create-page-body">
              <div className="sf-create-page-context">
                <span>
                  <i className="ph ph-globe-hemisphere-west" /> {data?.site.name}
                </span>
                <span>
                  {data?.language.name} · {data?.language.code.toUpperCase()}
                </span>
                <span className="sf-mono">
                  {addParent.slug === "/" ? "/" : `${addParent.slug}/`}
                </span>
              </div>
              <div className="sf-create-template-section">
                <span>Starting template</span>
                {templateLoadError ? (
                  <div className="sf-create-template-state error">
                    <i className="ph ph-warning-circle" />
                    <span>
                      <strong>Templates could not be loaded</strong>
                      <small>{templateLoadError}</small>
                    </span>
                    <Button unstyled onClick={() => void load(selection)}>
                      Retry
                    </Button>
                  </div>
                ) : !pageTemplates.length ? (
                  <div className="sf-create-template-state">
                    <i className="ph ph-stack" />
                    <span>
                      <strong>No templates available for this site</strong>
                      <small>Add one under Settings → Page templates first.</small>
                    </span>
                  </div>
                ) : (
                  <div className="sf-create-template-grid sf-scroll">
                    {pageTemplates.map((template) => {
                      const issues = validatePageTemplate(template);
                      const unavailable = template.status !== "published" || issues.length > 0;
                      const preferred =
                        addParent.preferredChildTemplate === template.key ||
                        addParent.preferredChildTemplate === template.name;
                      return (
                        <Button
                          unstyled
                          className={`${addTemplateKey === template.key ? "selected" : ""}${unavailable ? " unavailable" : ""}`}
                          disabled={unavailable}
                          key={template.key}
                          onClick={() => setAddTemplateKey(template.key)}
                          type="button"
                        >
                          <i className={`ph ${template.icon}`} />
                          <span>
                            <strong>
                              {template.name}
                              {preferred ? <b>Preferred</b> : null}
                              {template.fallback ? (
                                <b>
                                  <i className="ph-fill ph-push-pin" /> Fallback
                                </b>
                              ) : null}
                            </strong>
                            <small>{template.description}</small>
                            <em>
                              {template.components.length} components ·{" "}
                              {templateComponentSummary(template) || "Empty"}
                            </em>
                            {unavailable ? (
                              <em className="error">
                                <i className="ph-fill ph-warning-circle" /> Unavailable ·{" "}
                                {template.status === "draft"
                                  ? "template is still a draft"
                                  : `${issues.length} validation ${issues.length === 1 ? "issue" : "issues"}`}
                              </em>
                            ) : null}
                          </span>
                          {addTemplateKey === template.key ? (
                            <i className="ph-fill ph-check-circle" />
                          ) : null}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
              <label htmlFor="add-page-title">
                <span>Page title</span>
                <Input
                  unstyled
                  autoFocus
                  id="add-page-title"
                  value={addTitle}
                  onChange={(event) => {
                    setAddTitle(event.target.value);
                    if (!addSlugEdited) setAddSlug(slugifyTemplateKey(event.target.value));
                  }}
                  placeholder="Untitled page"
                />
              </label>
              <label htmlFor="add-page-slug">
                <span>URL slug</span>
                <div className="sf-add-slug">
                  <b>{addParent.slug === "/" ? "/" : `${addParent.slug}/`}</b>
                  <Input
                    unstyled
                    id="add-page-slug"
                    value={addSlug}
                    onChange={(event) => {
                      setAddSlugEdited(true);
                      setAddSlug(slugifyTemplateKey(event.target.value));
                    }}
                    placeholder="generated-from-title"
                  />
                </div>
              </label>
              <div className={`sf-resulting-url${slugCollision ? " collision" : ""}`}>
                <span>Resulting URL</span>
                <strong className="sf-mono">
                  {addParent.slug === "/" ? "/" : `${addParent.slug}/`}
                  {normalizedAddSlug}
                </strong>
                {slugCollision ? (
                  <em>
                    <i className="ph-fill ph-warning-circle" /> A page already uses this URL.
                  </em>
                ) : null}
              </div>
              {modalError ? <p className="sf-modal-error">{modalError}</p> : null}
            </div>
            <footer>
              <span className="sf-create-page-note">
                Templates provide starting content only · the page stays fully editable.
              </span>
              <ModalClose className="sf-action" disabled={creating}>
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sf-action primary"
                disabled={
                  !addTitle.trim() ||
                  !selectedAddTemplate ||
                  Boolean(addTemplateIssues.length) ||
                  slugCollision ||
                  creating
                }
                loading={creating}
                onClick={() => void create()}
              >
                {creating ? "Creating..." : "Create as concept"}
              </Button>
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
              <label htmlFor="rename-page-title">
                <span>Page title</span>
                <Input
                  unstyled
                  autoFocus
                  id="rename-page-title"
                  value={renameTitle}
                  onChange={(event) => setRenameTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void rename()}
                />
              </label>
              {modalError ? <p className="sf-modal-error">{modalError}</p> : null}
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={mutating}>
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sf-action primary"
                disabled={!renameTitle.trim() || mutating}
                loading={mutating}
                onClick={() => void rename()}
              >
                {mutating ? "Saving..." : "Save title"}
              </Button>
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
                <strong>{deleteTarget.title}</strong> will be permanently deleted. This cannot be
                undone.
              </p>
              {modalError ? <p className="sf-modal-error">{modalError}</p> : null}
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={mutating}>
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sf-action danger"
                disabled={mutating}
                loading={mutating}
                onClick={() => void remove()}
              >
                {mutating ? "Deleting..." : "Delete page"}
              </Button>
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
                  <strong>{pendingMove.impacts.length} URLs will change.</strong>
                  Review the old and proposed addresses before continuing.
                </span>
              </div>
              <div className="sf-impact-list sf-scroll">
                {pendingMove.impacts.map((impact) => (
                  <div className="sf-impact-row" key={impact.id}>
                    <div>
                      <strong>{impact.title}</strong>
                      {impact.published ? <span>Published</span> : <span>Concept</span>}
                    </div>
                    <code>{impact.oldPath}</code>
                    <i className="ph ph-arrow-right" />
                    <code>{impact.newPath}</code>
                  </div>
                ))}
              </div>
              <label className="sf-redirect-choice">
                <Input
                  unstyled
                  type="checkbox"
                  checked={createMoveRedirects}
                  disabled={!pendingMove.impacts.some((item) => item.published)}
                  onChange={(event) => setCreateMoveRedirects(event.target.checked)}
                />
                <span>
                  <strong>Create redirects from published URLs</strong>
                  {pendingMove.impacts.filter((item) => item.published).length} old published URL
                  {pendingMove.impacts.filter((item) => item.published).length === 1
                    ? ""
                    : "s"}{" "}
                  will continue to work.
                </span>
              </label>
              {modalError ? <p className="sf-modal-error">{modalError}</p> : null}
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={moving}>
                Cancel move
              </ModalClose>
              <Button
                unstyled
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
              </Button>
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
          <Button unstyled onClick={() => setToast(null)} aria-label="Dismiss notification">
            <i className="ph ph-x" />
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}
