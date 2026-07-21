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
import { cn } from "../lib/utils";

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
      <header className="sf-tree-head [display:flex] [align-items:center] [gap:12px] [padding:16px_22px_14px] [border-bottom:1px_solid_#eef1ed]">
        <div className="sf-tree-title [display:flex] [flex-direction:column] [gap:1px] [&_b]:text-ink-subtle [&_b]:[font:500_12px_'Geist_Mono'] [&_div]:[display:flex] [&_div]:[align-items:center] [&_div]:[gap:9px] [&_h1]:[margin:0] [&_h1]:[font-size:19px] [&_h1]:[font-weight:600] [&_h1]:[letter-spacing:-0.015em] [&>span]:[font-size:12px] [&>span]:text-ink-subtle">
          <div>
            <h1>Pages</h1>
            <b>{data?.pageCount ?? 0} pages</b>
          </div>
          <span>
            Canonical page tree · {data?.language.name ?? "English"} ·{" "}
            {(data?.language.code ?? "en").toUpperCase()}
          </span>
        </div>
        <span className="sf-spacer [flex:1]" />
        <label
          className="sf-search [display:flex] [height:36px] [width:248px] [align-items:center] [gap:8px] [border-radius:8px] bg-surface [padding:0_12px] [border:1.5px_solid_#cfd6d0] max-[800px]:[width:190px] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_i]:[font-size:15px] [&_i]:text-ink-subtle [&_input]:[width:100%] [&_input]:[padding:0] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]"
          htmlFor="page-search"
        >
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
          className={`sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126] ${filtersOpen || filtering ? "active" : ""}`}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <i className="ph ph-funnel" />
          Filters
          {filtering ? (
            <b className="sf-filter-count [display:grid] [height:17px] [min-width:17px] [place-items:center] [border-radius:999px] bg-action [font-size:10px] [color:#fff]">
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
          className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={filtering || expandableIds.size === 0}
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(expandableIds))}
          title={filtering ? "Clear search and filters to change the tree expansion" : undefined}
        >
          <i className={`ph ph-caret-double-${allExpanded ? "up" : "down"}`} />
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
        <Button
          unstyled
          className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          onClick={() => openAdd()}
        >
          <i className="ph-bold ph-plus" />
          Add page
        </Button>
      </header>
      {filtering && (
        <div
          className="sf-active-filters [display:flex] [min-height:42px] [align-items:center] [gap:7px] [padding:7px_22px] [background:#fafcfa] [border-bottom:1px_solid_#e7ece8] dark:[border-color:#323841] dark:[background:#1d2126] [&>.sf-reset-filters]:[margin-left:auto] [&>.sf-reset-filters]:[border-color:transparent] [&>.sf-reset-filters]:[font-weight:650] [&>.sf-reset-filters]:text-action [&>.sf-reset-filters]:[background:transparent] dark:[&>.sf-reset-filters]:[border-color:transparent] dark:[&>.sf-reset-filters]:[color:#b994f8] dark:[&>.sf-reset-filters]:[background:transparent] dark:[&>.sf-reset-filters:hover]:[background:#2c333b] [&>button]:[display:inline-flex] [&>button]:[height:27px] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[gap:5px] [&>button]:[border-radius:999px] [&>button]:[padding:0_8px] [&>button]:[font-size:11px] [&>button]:[font-weight:500] [&>button]:[color:#315b5e] [&>button]:[background:#f0f7f5] [&>button]:[border:1px_solid_#cfe1dd] dark:[&>button]:[border-color:#3d444e] dark:[&>button]:[color:#a9d7d5] dark:[&>button]:[background:#2c333b] [&>button_i]:[font-size:11px] [&>button_i]:[color:#6d8d89] dark:[&>button_i]:[color:#b994f8] [&>button:hover]:[border-color:#9fc9c2] [&>button:hover]:[background:#e4f1ee] dark:[&>button:hover]:[border-color:#515a65] dark:[&>button:hover]:[background:#2c333b] [&>span]:[margin-right:2px] [&>span]:[font-size:10.5px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:text-ink-subtle [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
          aria-label="Active filters"
        >
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
        <div className="sf-filter-bar [display:flex] [align-items:flex-end] [gap:12px] [padding:11px_22px] [background:#fafcfa] [border-bottom:1px_solid_var(--sf-sunken)] max-[900px]:[flex-wrap:wrap] dark:[border-color:#323841] dark:[background:#1d2126] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[gap:4px] max-[900px]:[&_label]:[flex:1] [&_label>span]:[font-size:10px] [&_label>span]:[font-weight:600] [&_label>span]:[letter-spacing:0.05em] [&_label>span]:text-ink-subtle [&_label>span]:[text-transform:uppercase] dark:[&_label>span]:[color:#79808b] [&_select]:[height:32px] [&_select]:[min-width:140px] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_28px_0_9px] [&_select]:[font-size:12px] [&_select]:[color:#33474a] [&_select]:[border:1px_solid_var(--sf-field)] max-[900px]:[&_select]:[width:100%] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] dark:[&_select:focus]:[border-color:#b994f8] dark:[&_select:focus]:[outline:3px_solid_rgb(185_148_248_/_16%)] [&>button]:[height:32px] [&>button]:[cursor:pointer] [&>button]:[padding:0_10px] [&>button]:[font-size:12px] [&>button]:[font-weight:600] [&>button]:text-action [&>button]:[background:transparent] [&>button]:[border:0] dark:[&>button]:[border-color:transparent] dark:[&>button]:[color:#b994f8] dark:[&>button]:[background:transparent] dark:[&>button:hover]:[background:#2c333b]">
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
      <div
        className="sf-tree-scroll sf-scroll [position:relative] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]"
        ref={scrollRef}
      >
        {error ? (
          <div
            className="sf-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]"
            style={{ width: "100%", height: "100%" }}
          >
            {error}
          </div>
        ) : rows.length ? (
          rows.map((page) => (
            <div
              aria-level={page.depth + 1}
              aria-selected={selected === page.id}
              className={cn(
                "sf-tree-row [position:relative] [z-index:0] [display:flex] [height:47px] [cursor:pointer] [align-items:center] [gap:8px] bg-surface [padding-right:14px] [border-bottom:1px_solid_#f5f7f4] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&.dragging]:[opacity:0.4] [&.drop-after::after]:[position:absolute] [&.drop-after::after]:[right:14px] [&.drop-after::after]:[bottom:-1px] [&.drop-after::after]:[left:inherit] [&.drop-after::after]:[z-index:4] [&.drop-after::after]:[height:2px] [&.drop-after::after]:[width:calc(100%_-_var(--drop-indent,_14px)_-_14px)] [&.drop-after::after]:[border-radius:2px] [&.drop-after::after]:bg-action [&.drop-after::after]:[content:''] [&.drop-before::before]:[position:absolute] [&.drop-before::before]:[top:-1px] [&.drop-before::before]:[right:14px] [&.drop-before::before]:[left:inherit] [&.drop-before::before]:[z-index:4] [&.drop-before::before]:[height:2px] [&.drop-before::before]:[width:calc(100%_-_var(--drop-indent,_14px)_-_14px)] [&.drop-before::before]:[border-radius:2px] [&.drop-before::before]:bg-action [&.drop-before::before]:[content:''] [&.drop-inside]:[z-index:2] [&.drop-inside]:bg-selection [&.drop-inside]:[box-shadow:inset_3px_0_var(--sf-accent)] [&.menu-open]:[z-index:30] [&.menu-open]:[filter:none] [&.muted]:[opacity:0.55] [&.selected]:bg-selection [&.selected]:[box-shadow:inset_3px_0_#96a0ac] dark:[&.selected]:[color:#b994f8] dark:[&.selected]:[background:#2c333b] [&:hover]:[filter:brightness(0.975)]",
                selected === page.id && "selected",
                page.muted && "muted",
                actionPage?.id === page.id && "menu-open",
                dragId === page.id && "dragging",
                dropTarget?.id === page.id && `drop-${dropTarget.position}`,
              )}
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
                className={cn(
                  "sf-tree-chevron [display:grid] [height:17px] [width:17px] [flex:none] [cursor:pointer] [place-items:center] [border-radius:4px] [color:#8a9895] [background:transparent] [border:0] [&.hidden]:[visibility:hidden]",
                  !page.hasChildren && "hidden",
                )}
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
              <span className="sf-tree-icon [display:flex] [width:17px] [flex:none] [font-size:16px] [color:#718784]">
                <i
                  className={`ph ${page.depth === 0 ? "ph-house" : page.hasChildren ? "ph-folder" : "ph-file-text"}`}
                />
              </span>
              <span className="sf-tree-name [font-size:13.5px] [font-weight:500] [white-space:nowrap] text-ink dark:[color:#e9ecf1]">
                {page.title}
              </span>
              <span className="sf-tree-slug [white-space:nowrap] [color:#9aa8a4] [font:400_12px_'Geist_Mono'] dark:[color:#79808b]">
                {ownSlug(page.slug)}
              </span>
              <span className="sf-spacer [flex:1]" />
              <span className="sf-template [border-radius:5px] bg-sunken [padding:2px_8px] [font-size:11.5px] [white-space:nowrap] text-ink-muted max-[800px]:[display:none] dark:[color:#a7aeb8] dark:[background:#263336]">
                {templateForPage(page)?.name ?? page.template}
              </span>
              <StatusPill status={page.status} />
              {page.validation === "Needs attention" ? (
                <span
                  className="sf-validation-badge [display:inline-flex] [height:22px] [align-items:center] [gap:4px] [border-radius:5px] bg-danger-soft [padding:0_7px] [font-size:11px] [font-weight:700] text-danger dark:[color:#f0857a] dark:[background:#321f1e]"
                  title="Needs attention"
                >
                  <i className="ph-fill ph-warning" />1
                </span>
              ) : null}
              <Button
                unstyled
                aria-label={`Add under ${page.title}`}
                className="sf-row-icon [display:grid] [height:26px] [width:26px] [flex:none] [cursor:pointer] [place-items:center] [border-radius:6px] [color:#aebab6] [background:transparent] [border:0] [&.active]:bg-selection [&.active]:text-action [&:hover]:bg-selection [&:hover]:text-action"
                onClick={(event) => {
                  event.stopPropagation();
                  setAddQuickParent((current) => (current?.id === page.id ? null : page));
                }}
              >
                <i className="ph-bold ph-plus" />
              </Button>
              {addQuickParent?.id === page.id ? (
                <div
                  className="sf-add-page-quick-menu [position:absolute] [top:37px] [right:44px] [z-index:18] [display:flex] [width:286px] [animation:sf-overview-menu_0.13s_ease] [flex-direction:column] [gap:2px] [border-radius:10px] bg-surface [padding:6px] [box-shadow:0_12px_32px_rgb(23_35_38_/_18%)] [border:1px_solid_var(--sf-border)] [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle [&_strong]:[font-size:13px] [&_strong]:text-ink [&>button]:[display:flex] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[gap:10px] [&>button]:[border-radius:7px] [&>button]:[padding:9px] [&>button]:[text-align:left] [&>button]:[background:transparent] [&>button]:[border:0] [&>button:hover]:bg-selection [&>button>i]:[display:grid] [&>button>i]:[height:30px] [&>button>i]:[width:30px] [&>button>i]:[flex:none] [&>button>i]:[place-items:center] [&>button>i]:[border-radius:7px] [&>button>i]:bg-sunken [&>button>i]:[font-size:16px] [&>button>i]:text-action [&>button>span]:[display:flex] [&>button>span]:[min-width:0] [&>button>span]:[flex-direction:column] [&>button>span]:[gap:2px]"
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
                className={cn(
                  "sf-row-icon [display:grid] [height:26px] [width:26px] [flex:none] [cursor:pointer] [place-items:center] [border-radius:6px] [color:#aebab6] [background:transparent] [border:0] [&.active]:bg-selection [&.active]:text-action [&:hover]:bg-selection [&:hover]:text-action",
                  actionPage?.id === page.id && "active",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  setActionPage((current) => (current?.id === page.id ? null : page));
                }}
              >
                <i className="ph-bold ph-dots-three" />
              </Button>
              {actionPage?.id === page.id ? (
                <div
                  className="sf-row-menu [position:absolute] [top:calc(100%_-_4px)] [right:8px] [z-index:25] [width:178px] [border-radius:9px] bg-surface [padding:5px] [box-shadow:0_12px_28px_rgba(23,_35,_38,_0.16)] [border:1px_solid_#dfe5df] [&_button]:[display:flex] [&_button]:[width:100%] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:8px] [&_button]:[border-radius:6px] [&_button]:[padding:8px_9px] [&_button]:[text-align:left] [&_button]:[font-size:12px] [&_button]:[color:#33474a] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.danger]:text-danger [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.42] [&_button:disabled:hover]:[background:transparent] [&_button:hover]:[background:#f2f6f3]"
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
          <div className="sf-tree-empty [display:flex] [height:100%] [min-height:300px] [flex-direction:column] [align-items:center] [justify-content:center] text-ink-subtle [&_button]:[margin-top:12px] [&_button]:[cursor:pointer] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:text-action [&_button]:[background:transparent] [&_button]:[border:0] [&_span]:[margin-top:4px] [&_span]:[font-size:12px] [&_strong]:[margin-top:10px] [&_strong]:[font-size:14px] [&_strong]:[color:#33474a] [&>i]:[font-size:25px]">
            <i className="ph ph-magnifying-glass" />
            <strong>No pages found</strong>
            <span>Try a different search or clear your filters.</span>
            <Button unstyled onClick={() => updateUrlView("", defaultFilters)}>
              Clear filters
            </Button>
          </div>
        )}
      </div>
      <footer className="sf-tree-foot [display:flex] [align-items:center] [gap:14px] [padding:9px_22px] [font-size:12px] text-ink-subtle [background:#fafcfa] [border-top:1px_solid_#eef1ed] dark:[border-color:#323841] dark:[color:#79808b] dark:[background:#1d2126] [&_i]:[font-size:15px] [&_i]:text-action">
        <i className="ph ph-arrows-out-cardinal" />
        Drag a row to reorder, or onto another page to reparent
        <span className="sf-spacer [flex:1]" />
        <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
          {rows.filter((row) => !row.muted).length} matching · {rows.length} shown
        </span>
      </footer>
      <Modal
        className="sf-create-page-modal [width:min(760px,_calc(100vw_-_40px))]"
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
            <div className="sf-overview-modal-body sf-create-page-body [display:flex] [max-height:min(680px,_calc(100vh_-_190px))] [flex-direction:column] [gap:15px] [overflow:auto] [padding:20px] [&_.sf-redirect-choice_input[type='checkbox']]:[margin:1px_0_0] [&_.sf-redirect-choice_input[type='checkbox']]:[height:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[min-width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[flex:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border-radius:3px] [&_.sf-redirect-choice_input[type='checkbox']]:[padding:0] [&_.sf-redirect-choice_input[type='checkbox']]:[accent-color:var(--sf-accent)] [&_.sf-redirect-choice_input[type='checkbox']]:[box-shadow:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border:0] [&_input]:[height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sf-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_label>span]:[font-size:11.5px] [&_label>span]:[font-weight:600] [&_label>span]:text-ink-muted [&_select]:[height:38px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sf-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>label]:[display:flex] [&>label]:[flex-direction:column] [&>label]:[gap:5px]">
              <div className="sf-create-page-context [display:flex] [align-items:center] [gap:9px] [border-radius:9px] bg-canvas [padding:9px_11px] [font-size:12px] text-ink-muted [border:1px_solid_var(--sf-border)] [&>span]:[display:inline-flex] [&>span]:[align-items:center] [&>span]:[gap:5px] [&>span+span::before]:[margin-right:4px] [&>span+span::before]:text-ink-subtle [&>span+span::before]:[content:'·']">
                <span>
                  <i className="ph ph-globe-hemisphere-west" /> {data?.site.name}
                </span>
                <span>
                  {data?.language.name} · {data?.language.code.toUpperCase()}
                </span>
                <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
                  {addParent.slug === "/" ? "/" : `${addParent.slug}/`}
                </span>
              </div>
              <div className="sf-create-template-section [display:flex] [flex-direction:column] [gap:7px] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:text-ink-subtle [&>span]:[text-transform:uppercase]">
                <span>Starting template</span>
                {templateLoadError ? (
                  <div className="sf-create-template-state error [display:flex] [align-items:center] [gap:10px] [border-radius:10px] bg-canvas [padding:13px] [border:1px_dashed_var(--sf-border)] [&_small]:[font-size:11.5px] [&_small]:text-ink-muted [&.error>i]:text-danger [&>i]:[font-size:22px] [&>i]:text-action [&>span]:[display:flex] [&>span]:[flex:1] [&>span]:[flex-direction:column] [&>span]:[gap:2px]">
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
                  <div className="sf-create-template-state [display:flex] [align-items:center] [gap:10px] [border-radius:10px] bg-canvas [padding:13px] [border:1px_dashed_var(--sf-border)] [&_small]:[font-size:11.5px] [&_small]:text-ink-muted [&.error>i]:text-danger [&>i]:[font-size:22px] [&>i]:text-action [&>span]:[display:flex] [&>span]:[flex:1] [&>span]:[flex-direction:column] [&>span]:[gap:2px]">
                    <i className="ph ph-stack" />
                    <span>
                      <strong>No templates available for this site</strong>
                      <small>Add one under Settings → Page templates first.</small>
                    </span>
                  </div>
                ) : (
                  <div className="sf-create-template-grid sf-scroll [display:grid] [max-height:330px] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [grid-template-columns:1fr_1fr] [gap:10px] [overflow:auto] [padding:2px] [&_em]:[overflow:hidden] [&_em]:[font-size:10.5px] [&_em]:[text-overflow:ellipsis] [&_em]:[white-space:nowrap] [&_em]:text-ink-subtle [&_em]:[font-style:normal] [&_em.error]:text-danger [&_small]:[display:-webkit-box] [&_small]:[overflow:hidden] [&_small]:[font-size:11.5px] [&_small]:[line-height:1.4] [&_small]:text-ink-muted [&_small]:[-webkit-box-orient:vertical] [&_small]:[-webkit-line-clamp:2] [&_strong]:[display:flex] [&_strong]:[flex-wrap:wrap] [&_strong]:[align-items:center] [&_strong]:[gap:5px] [&_strong]:[font-size:13px] [&_strong_b]:[display:inline-flex] [&_strong_b]:[height:18px] [&_strong_b]:[align-items:center] [&_strong_b]:[gap:3px] [&_strong_b]:[border-radius:999px] [&_strong_b]:[padding:0_5px] [&_strong_b]:[font-size:9.5px] [&_strong_b]:[color:#33474a] [&_strong_b]:[background:#dfe3e8] dark:[&_strong_b]:[color:#c5cdd6] dark:[&_strong_b]:[background:#333b44] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff] [&>button]:[position:relative] [&>button]:[display:flex] [&>button]:[min-width:0] [&>button]:[cursor:pointer] [&>button]:[align-items:flex-start] [&>button]:[gap:10px] [&>button]:[border-radius:10px] [&>button]:bg-surface [&>button]:[padding:11px] [&>button]:[text-align:left] [&>button]:text-ink [&>button]:[border:1.5px_solid_var(--sf-border)] [&>button.selected]:border-selection-border [&>button.selected]:bg-selection [&>button.unavailable]:[cursor:not-allowed] [&>button.unavailable]:[opacity:0.58] [&>button:hover]:border-selection-border [&>button:hover]:bg-canvas [&>button>i:first-child]:[display:grid] [&>button>i:first-child]:[height:32px] [&>button>i:first-child]:[width:32px] [&>button>i:first-child]:[flex:none] [&>button>i:first-child]:[place-items:center] [&>button>i:first-child]:[border-radius:8px] [&>button>i:first-child]:bg-sunken [&>button>i:first-child]:[font-size:17px] [&>button>i:first-child]:text-action [&>button>i:last-child]:[font-size:16px] [&>button>i:last-child]:text-action [&>button>span]:[display:flex] [&>button>span]:[min-width:0] [&>button>span]:[flex:1] [&>button>span]:[flex-direction:column] [&>button>span]:[gap:4px]">
                    {pageTemplates.map((template) => {
                      const issues = validatePageTemplate(template);
                      const unavailable = template.status !== "published" || issues.length > 0;
                      const preferred =
                        addParent.preferredChildTemplate === template.key ||
                        addParent.preferredChildTemplate === template.name;
                      return (
                        <Button
                          unstyled
                          className={cn(
                            addTemplateKey === template.key && "selected",
                            unavailable && "unavailable",
                          )}
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
                <div className="sf-add-slug [display:flex] [align-items:center] [overflow:hidden] [border-radius:8px] [border:1.5px_solid_var(--sf-field)] [&_b]:[max-width:200px] [&_b]:[overflow:hidden] [&_b]:[padding-left:10px] [&_b]:[text-overflow:ellipsis] [&_b]:[white-space:nowrap] [&_b]:[color:#a5b0ad] [&_b]:[font:12px_'Geist_Mono'] [&_input]:[min-width:80px] [&_input]:[flex:1] [&_input]:[font-family:'Geist_Mono'] [&_input]:[box-shadow:none] [&_input]:[border:0] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
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
              <div
                className={cn(
                  "sf-resulting-url [display:grid] [grid-template-columns:110px_1fr] [align-items:center] [gap:4px_10px] [border-radius:9px] bg-canvas [padding:9px_11px] [border:1px_solid_var(--sf-border)] [&_em]:[grid-column:2] [&_em]:[font-size:11.5px] [&_em]:text-danger [&_em]:[font-style:normal] [&_strong]:[overflow:hidden] [&_strong]:[font-size:12px] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_strong]:text-ink [&.collision]:[border-color:#eec6bc] [&.collision]:[background:#fdf4f2] dark:[&.collision]:[border-color:#4a2e27] dark:[&.collision]:[background:#3a2320] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:text-ink-subtle [&>span]:[text-transform:uppercase]",
                  slugCollision && "collision",
                )}
              >
                <span>Resulting URL</span>
                <strong className="sf-mono [font-family:'Geist_Mono',_monospace]">
                  {addParent.slug === "/" ? "/" : `${addParent.slug}/`}
                  {normalizedAddSlug}
                </strong>
                {slugCollision ? (
                  <em>
                    <i className="ph-fill ph-warning-circle" /> A page already uses this URL.
                  </em>
                ) : null}
              </div>
              {modalError ? (
                <p className="sf-modal-error [margin:0] [border-radius:7px] [padding:9px_10px] [font-size:12px] [color:#a52f26] [background:#f9e8e5] [font:11.5px_'Geist']">
                  {modalError}
                </p>
              ) : null}
            </div>
            <footer>
              <span className="sf-create-page-note [margin-right:auto] [max-width:270px] [font-size:11.5px] [line-height:1.4] text-ink-subtle">
                Templates provide starting content only · the page stays fully editable.
              </span>
              <ModalClose
                className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={creating}
              >
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
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
            <div className="sf-overview-modal-body [display:flex] [flex-direction:column] [gap:15px] [padding:20px] [&_.sf-redirect-choice_input[type='checkbox']]:[margin:1px_0_0] [&_.sf-redirect-choice_input[type='checkbox']]:[height:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[min-width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[flex:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border-radius:3px] [&_.sf-redirect-choice_input[type='checkbox']]:[padding:0] [&_.sf-redirect-choice_input[type='checkbox']]:[accent-color:var(--sf-accent)] [&_.sf-redirect-choice_input[type='checkbox']]:[box-shadow:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border:0] [&_input]:[height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sf-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_label>span]:[font-size:11.5px] [&_label>span]:[font-weight:600] [&_label>span]:text-ink-muted [&_select]:[height:38px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sf-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>label]:[display:flex] [&>label]:[flex-direction:column] [&>label]:[gap:5px]">
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
              {modalError ? (
                <p className="sf-modal-error [margin:0] [border-radius:7px] [padding:9px_10px] [font-size:12px] [color:#a52f26] [background:#f9e8e5] [font:11.5px_'Geist']">
                  {modalError}
                </p>
              ) : null}
            </div>
            <footer>
              <ModalClose
                className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={mutating}
              >
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
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
            <div className="sf-overview-modal-body [display:flex] [flex-direction:column] [gap:15px] [padding:20px] [&_.sf-redirect-choice_input[type='checkbox']]:[margin:1px_0_0] [&_.sf-redirect-choice_input[type='checkbox']]:[height:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[min-width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[flex:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border-radius:3px] [&_.sf-redirect-choice_input[type='checkbox']]:[padding:0] [&_.sf-redirect-choice_input[type='checkbox']]:[accent-color:var(--sf-accent)] [&_.sf-redirect-choice_input[type='checkbox']]:[box-shadow:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border:0] [&_input]:[height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sf-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_label>span]:[font-size:11.5px] [&_label>span]:[font-weight:600] [&_label>span]:text-ink-muted [&_select]:[height:38px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sf-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>label]:[display:flex] [&>label]:[flex-direction:column] [&>label]:[gap:5px]">
              <p className="sf-delete-copy [margin:0] text-ink-muted [font:13px/1.5_'Geist'] [&_strong]:text-ink">
                <strong>{deleteTarget.title}</strong> will be permanently deleted. This cannot be
                undone.
              </p>
              {modalError ? (
                <p className="sf-modal-error [margin:0] [border-radius:7px] [padding:9px_10px] [font-size:12px] [color:#a52f26] [background:#f9e8e5] [font:11.5px_'Geist']">
                  {modalError}
                </p>
              ) : null}
            </div>
            <footer>
              <ModalClose
                className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={mutating}
              >
                Cancel
              </ModalClose>
              <Button
                unstyled
                className="sf-action danger [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
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
        className="sf-impact-modal [width:min(760px,_100%)] [&_.sf-overview-modal-body]:[gap:14px]"
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
            <div className="sf-overview-modal-body [display:flex] [flex-direction:column] [gap:15px] [padding:20px] [&_.sf-redirect-choice_input[type='checkbox']]:[margin:1px_0_0] [&_.sf-redirect-choice_input[type='checkbox']]:[height:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[min-width:17px] [&_.sf-redirect-choice_input[type='checkbox']]:[flex:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border-radius:3px] [&_.sf-redirect-choice_input[type='checkbox']]:[padding:0] [&_.sf-redirect-choice_input[type='checkbox']]:[accent-color:var(--sf-accent)] [&_.sf-redirect-choice_input[type='checkbox']]:[box-shadow:none] [&_.sf-redirect-choice_input[type='checkbox']]:[border:0] [&_input]:[height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sf-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_label>span]:[font-size:11.5px] [&_label>span]:[font-weight:600] [&_label>span]:text-ink-muted [&_select]:[height:38px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sf-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>label]:[display:flex] [&>label]:[flex-direction:column] [&>label]:[gap:5px]">
              <div className="sf-impact-summary [display:flex] [align-items:flex-start] [gap:10px] [border-radius:8px] [padding:11px_12px] [color:#73551a] [background:#fbf6e9] [border:1px_solid_#ead6aa] [&>i]:[margin-top:1px] [&>i]:[font-size:18px] [&>span]:[display:flex] [&>span]:[flex-direction:column] [&>span]:[gap:2px] [&>span]:[font-size:12px]">
                <i className="ph ph-warning-circle" />
                <span>
                  <strong>{pendingMove.impacts.length} URLs will change.</strong>
                  Review the old and proposed addresses before continuing.
                </span>
              </div>
              <div className="sf-impact-list sf-scroll [max-height:310px] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [border-radius:9px] [border:1px_solid_var(--sf-border)] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
                {pendingMove.impacts.map((impact) => (
                  <div
                    className="sf-impact-row [display:grid] [grid-template-columns:minmax(170px,_0.8fr)_minmax(150px,_1fr)_20px_minmax(150px,_1fr)] [align-items:center] [gap:10px] [padding:10px_12px] [border-bottom:1px_solid_var(--sf-sunken)] max-[900px]:[grid-template-columns:1fr] [&_code]:[overflow:hidden] [&_code]:[text-overflow:ellipsis] [&_code]:[white-space:nowrap] [&_code]:text-ink-muted [&_code]:[font:10.5px_'Geist_Mono'] [&_code:last-child]:text-action [&_span]:[font-size:10.5px] [&_span]:text-ink-subtle [&_strong]:[overflow:hidden] [&_strong]:[font-size:11.5px] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&:last-child]:[border-bottom:0] [&>div]:[display:flex] [&>div]:[min-width:0] [&>div]:[flex-direction:column] [&>div]:[gap:2px] [&>i]:[text-align:center] [&>i]:text-ink-subtle max-[900px]:[&>i]:[transform:rotate(90deg)] max-[900px]:[&>i]:[text-align:left]"
                    key={impact.id}
                  >
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
              <label className="sf-redirect-choice [display:flex] [cursor:pointer] [flex-direction:row] [align-items:flex-start] [gap:10px] [border-radius:8px] [padding:11px_12px] [background:#f6faf8] [border:1px_solid_#d7e3df] [&_strong]:[font-size:12px] [&_strong]:[color:#33474a] [&>span]:[display:flex] [&>span]:[flex-direction:column] [&>span]:[gap:2px] [&>span]:[font-size:11.5px] [&>span]:[font-weight:400] [&>span]:[color:#71817f]">
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
              {modalError ? (
                <p className="sf-modal-error [margin:0] [border-radius:7px] [padding:9px_10px] [font-size:12px] [color:#a52f26] [background:#f9e8e5] [font:11.5px_'Geist']">
                  {modalError}
                </p>
              ) : null}
            </div>
            <footer>
              <ModalClose
                className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={moving}
              >
                Cancel move
              </ModalClose>
              <Button
                unstyled
                className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
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
        <div
          className="sf-tree-toast [position:fixed] [right:22px] [bottom:22px] [z-index:70] [display:flex] [width:min(390px,_calc(100vw_-_44px))] [align-items:flex-start] [gap:11px] [border-radius:10px] bg-surface [padding:13px_14px] [box-shadow:0_14px_40px_rgba(23,_35,_38,_0.2)] [border:1px_solid_#d7e3df] [&_button]:[display:grid] [&_button]:[height:24px] [&_button]:[width:24px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:5px] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_span]:[font-size:11.5px] [&_span]:[color:#71817f] [&_strong]:[font-size:12.5px] [&>div]:[display:flex] [&>div]:[min-width:0] [&>div]:[flex:1] [&>div]:[flex-direction:column] [&>div]:[gap:2px] [&>i]:[display:grid] [&>i]:[height:27px] [&>i]:[width:27px] [&>i]:[flex:none] [&>i]:[place-items:center] [&>i]:[border-radius:7px] [&>i]:bg-selection [&>i]:[font-size:15px] [&>i]:text-action"
          role="status"
        >
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
