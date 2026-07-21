import { Button } from "./ui/button";
import { LoadingSplash, RouteLoading } from "./loading";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { useNavigate } from "@tanstack/react-router";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import {
  createNavigationItem,
  loadNavigationWorkspace,
  publishNavigation,
  saveNavigationDraft,
  type NavigationItem,
  type NavigationKind,
  type NavigationLocation,
  type NavigationWorkspace,
} from "../lib/navigation";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "./modal";

type Device = "desktop" | "tablet" | "mobile";

const itemTheme = {
  link: { icon: "ph-link-simple", bg: "#eceef1", fg: "#763fba" },
  group: { icon: "ph-columns", bg: "#EDE7F5", fg: "#5B4B8A" },
  button: { icon: "ph-cursor-click", bg: "#FBEBE1", fg: "#B45F38" },
} as const;

function move<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function allItems(items: NavigationItem[]) {
  return items.flatMap((item) => [item, ...item.children]);
}

function parentOf(items: NavigationItem[], childId: string) {
  return items.find((item) => item.children.some((child) => child.id === childId));
}

const navigationWorkspaceCache = new Map<string, NavigationWorkspace>();

export function NavigationEditor({ location }: { location: NavigationLocation }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const cacheKey = user ? `${user.id}:${location}` : "";
  const cachedWorkspace = cacheKey ? (navigationWorkspaceCache.get(cacheKey) ?? null) : null;
  const [workspace, setWorkspace] = useState<NavigationWorkspace | null>(cachedWorkspace);
  const [items, setItems] = useState<NavigationItem[]>(cachedWorkspace?.items ?? []);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(cachedWorkspace?.items ?? []));
  const [publishedSnapshot, setPublishedSnapshot] = useState(
    JSON.stringify(cachedWorkspace?.publishedItems ?? []),
  );
  const [loading, setLoading] = useState(!cachedWorkspace);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [device, setDevice] = useState<Device>("desktop");
  const [addOpen, setAddOpen] = useState(false);
  const [previewGroup, setPreviewGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(true);
  const [mobileGroups, setMobileGroups] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFooter = location === "footer";
  const saving = savingAction !== null;
  const currentSnapshot = JSON.stringify(items);
  const dirty = currentSnapshot !== savedSnapshot;
  const published = currentSnapshot === publishedSnapshot && !dirty;
  const livePaths = useMemo(
    () => new Set(workspace?.pageOptions.map((page) => page.path) ?? []),
    [workspace],
  );
  const brokenItems = useMemo(
    () =>
      allItems(items).filter(
        (item) =>
          item.kind !== "group" && item.targetType === "page" && !livePaths.has(item.target),
      ),
    [items, livePaths],
  );

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void loadNavigationWorkspace(location)
      .then((data) => {
        setWorkspace(data);
        if (data) {
          navigationWorkspaceCache.set(`${user.id}:${location}`, data);
          setItems(data.items);
          setSavedSnapshot(JSON.stringify(data.items));
          setPublishedSnapshot(JSON.stringify(data.publishedItems));
        }
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load navigation."),
      )
      .finally(() => setLoading(false));
  }, [user, location]);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const updateItem = (id: string, patch: Partial<NavigationItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...patch }
          : {
              ...item,
              children: item.children.map((child) =>
                child.id === id ? { ...child, ...patch } : child,
              ),
            },
      ),
    );
  };

  const selectItem = (id: string) => {
    setSelected(id);
    const parent = parentOf(items, id);
    setExpanded((current) => new Set(current).add(parent?.id ?? id));
    if (parent) setPreviewGroup(parent.id);
  };

  const moveTop = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    setItems(move(items, index, index + direction));
  };

  const moveChild = (parentId: string, childId: string, direction: -1 | 1) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== parentId) return item;
        const index = item.children.findIndex((child) => child.id === childId);
        return {
          ...item,
          children: move(item.children, index, index + direction),
        };
      }),
    );
  };

  const addItem = (kind: NavigationKind, external = false) => {
    const item = createNavigationItem(kind, external ? "url" : "page");
    if (isFooter && kind === "group") item.label = "New column";
    setItems((current) => [...current, item]);
    setSelected(item.id);
    setExpanded((current) => new Set(current).add(item.id));
    setAddOpen(false);
  };

  const addChild = (parentId: string) => {
    const child = createNavigationItem("link");
    child.label = "New link";
    setItems((current) =>
      current.map((item) =>
        item.id === parentId ? { ...item, children: [...item.children, child] } : item,
      ),
    );
    setSelected(child.id);
    setExpanded((current) => new Set(current).add(parentId));
  };

  const removeItem = (id: string) => {
    let removed = "item";
    setItems((current) =>
      current
        .filter((item) => {
          if (item.id === id) removed = item.label;
          return item.id !== id;
        })
        .map((item) => ({
          ...item,
          children: item.children.filter((child) => {
            if (child.id === id) removed = child.label;
            return child.id !== id;
          }),
        })),
    );
    setSelected(null);
    showToast(`Removed ${removed}`);
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDropId(null);
      return;
    }
    const from = items.findIndex((item) => item.id === dragId);
    const to = items.findIndex((item) => item.id === targetId);
    setItems(move(items, from, to));
    setDragId(null);
    setDropId(null);
  };

  const save = async () => {
    if (!workspace || saving) return;
    setSavingAction("draft");
    setError("");
    try {
      await saveNavigationDraft(workspace.menuId, items);
      setSavedSnapshot(JSON.stringify(items));
      showToast(`${isFooter ? "Footer" : "Header navigation"} draft saved`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save draft.");
    } finally {
      setSavingAction(null);
    }
  };

  const publish = async () => {
    if (!workspace || saving) return;
    setSavingAction("publish");
    setError("");
    try {
      await publishNavigation(workspace.menuId, items);
      const snapshot = JSON.stringify(items);
      setSavedSnapshot(snapshot);
      setPublishedSnapshot(snapshot);
      setPublishConfirm(false);
      showToast(`${isFooter ? "Footer" : "Header navigation"} published`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish changes.");
    } finally {
      setSavingAction(null);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (authLoading || !user) return <LoadingSplash />;
  if (loading && !workspace)
    return (
      <main className="sf-navigation-editor sf-navigation-loading [display:flex] [height:100vh] [width:100vw] [animation:sf-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-surface motion-reduce:[animation:none] dark:[color:#e9ecf1] dark:[background:#15181c] [&_.sf-route-loading]:[width:100%]">
        <header className="sf-navigation-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[background:#1d2126]">
          <Button
            unstyled
            className="sf-back-button [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:bg-canvas dark:[&:hover]:[background:#242930]"
            disabled
            type="button"
          >
            <i className="ph-bold ph-arrow-left" /> Back
          </Button>
          <div className="sf-navigation-title [display:grid] [grid-template-columns:auto_auto] [align-items:center] [gap:0_16px] [font-size:12px] max-[760px]:[display:flex] max-[760px]:[flex-direction:column] max-[760px]:[align-items:flex-start] max-[760px]:[gap:1px] [&>small]:[grid-column:1_/_-1] [&>small]:[font-size:11px] [&>small]:text-action [&>span]:text-ink-subtle max-[760px]:[&>span]:[display:none] [&>strong]:[font-weight:600]">
            <span>Navigation</span>
            <strong>{isFooter ? "Footer" : "Header"}</strong>
            <small>Loading workspace</small>
          </div>
        </header>
        <RouteLoading
          detail="The builder will be ready in a moment."
          title={`Loading ${isFooter ? "footer" : "header navigation"}`}
        />
      </main>
    );
  if (!workspace)
    return (
      <div className="sf-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
        {error || "No website is available."}
      </div>
    );

  return (
    <main className="sf-navigation-editor [display:flex] [height:100vh] [width:100vw] [animation:sf-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-surface motion-reduce:[animation:none] dark:[color:#e9ecf1] dark:[background:#15181c]">
      <header className="sf-navigation-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[background:#1d2126]">
        <Button
          unstyled
          className="sf-back-button [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:bg-canvas dark:[&:hover]:[background:#242930]"
          onClick={() => void navigate({ to: "/" })}
          type="button"
        >
          <i className="ph-bold ph-arrow-left" /> Back
        </Button>
        <div className="sf-navigation-title [display:grid] [grid-template-columns:auto_auto] [align-items:center] [gap:0_16px] [font-size:12px] max-[760px]:[display:flex] max-[760px]:[flex-direction:column] max-[760px]:[align-items:flex-start] max-[760px]:[gap:1px] [&>small]:[grid-column:1_/_-1] [&>small]:[font-size:11px] [&>small]:text-action [&>span]:text-ink-subtle max-[760px]:[&>span]:[display:none] [&>strong]:[font-weight:600]">
          <span>Navigation</span>
          <strong>{isFooter ? "Footer" : "Header"}</strong>
          <small className="sf-mono [font-family:'Geist_Mono',_monospace]">
            {isFooter ? "Site footer" : "Primary menu"} · {workspace.language.code.toUpperCase()}
          </small>
        </div>
        <span className={`sf-editor-status ${published ? "Published" : "Concept"}`}>
          {published ? "Published" : "Draft"}
        </span>
        {brokenItems.length ? (
          <span className="sf-navigation-broken [display:inline-flex] [height:22px] [align-items:center] [gap:5px] [border-radius:5px] bg-danger-soft [padding:0_8px] [font-size:11.5px] [font-weight:600] text-danger max-[760px]:[display:none]">
            <i className="ph-fill ph-warning" /> {brokenItems.length} broken{" "}
            {brokenItems.length === 1 ? "link" : "links"}
          </span>
        ) : null}
        <span className="sf-spacer [flex:1]" />
        <span className="sf-navigation-saved [display:inline-flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle max-[980px]:[display:none] dark:[color:#79808b] [&_.ph-spinner]:[animation:sf-navigation-spin_700ms_linear_infinite] [&_i]:[font-size:14px]">
          <i className={`ph ${saving ? "ph-spinner" : dirty ? "ph-cloud" : "ph-cloud-check"}`} />
          {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button
          unstyled
          className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={!dirty || saving}
          loading={savingAction === "draft"}
          onClick={() => void save()}
          type="button"
        >
          <i className="ph ph-floppy-disk" /> Save draft
        </Button>
        <Button
          unstyled
          className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={saving}
          loading={savingAction === "publish"}
          onClick={() => (brokenItems.length ? setPublishConfirm(true) : void publish())}
          type="button"
        >
          <i className="ph-bold ph-rocket-launch" /> Publish changes
        </Button>
      </header>

      <div className="sf-navigation-workspace [display:flex] [min-height:0] [flex:1] max-[760px]:[flex-direction:column]">
        <section className="sf-navigation-preview [display:flex] [min-width:0] [flex:1] [flex-direction:column] bg-sunken [border-right:1px_solid_var(--sf-border)] max-[760px]:[min-height:48%] max-[760px]:[border-bottom:1px_solid_var(--sf-border)] max-[760px]:[border-right:0] dark:[border-color:#323841] dark:[background:#15181c] [&_.sf-preview-tools]:[height:48px] [&_.sf-preview-tools]:[flex:none] [&_.sf-preview-tools]:[padding:0_16px] [&_.sf-preview-tools]:[background:#fafcfa] dark:[&_.sf-preview-tools]:[border-color:#323841] dark:[&_.sf-preview-tools]:[background:#1d2126] [&_.sf-preview-tools>button]:[display:grid] [&_.sf-preview-tools>button]:[height:32px] [&_.sf-preview-tools>button]:[width:32px] [&_.sf-preview-tools>button]:[cursor:pointer] [&_.sf-preview-tools>button]:[place-items:center] [&_.sf-preview-tools>button]:[border-radius:8px] [&_.sf-preview-tools>button]:[padding:0] [&_.sf-preview-tools>button]:text-ink-muted [&_.sf-preview-tools>button]:[background:transparent] [&_.sf-preview-tools>button]:[border:0] [&_.sf-preview-tools>button.spin_i]:[animation:sf-navigation-spin_500ms_linear] [&_.sf-preview-tools>button:hover]:bg-sunken [&_.sf-preview-tools>button:hover]:text-ink dark:[&_.sf-preview-tools>button:hover]:[color:#b994f8] dark:[&_.sf-preview-tools>button:hover]:[background:#2c333b]">
          <div className="sf-preview-tools flex h-12 shrink-0 items-center gap-3 border-b border-border bg-[#fafcfa] px-4 dark:bg-surface">
            <div className="sf-device-toggle flex gap-0.5 rounded-lg bg-[#eaeeea] p-0.5 dark:bg-canvas [&_button]:grid [&_button]:h-7 [&_button]:w-[30px] [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-base [&_button]:text-ink-subtle [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:shadow-[0_1px_2px_rgb(23_35_38_/_14%)] dark:[&_button.active]:bg-selection dark:[&_button.active]:text-action dark:[&_button.active]:shadow-none">
              {(
                [
                  ["desktop", "ph-monitor", "Desktop"],
                  ["tablet", "ph-device-tablet", "Tablet"],
                  ["mobile", "ph-device-mobile", "Mobile"],
                ] as const
              ).map(([value, icon, label]) => (
                <Button
                  unstyled
                  className={device === value ? "active" : ""}
                  key={value}
                  onClick={() => setDevice(value)}
                  title={label}
                  type="button"
                >
                  <i className={`ph-bold ${icon}`} />
                </Button>
              ))}
            </div>
            <div className="sf-preview-url flex h-8 max-w-[440px] min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 dark:border-field [&>b]:rounded-full [&>b]:bg-concept-soft [&>b]:px-1.5 [&>b]:py-px [&>b]:text-[10px] [&>b]:text-concept [&>i]:text-xs [&>i]:text-published [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:font-mono [&>span]:text-xs [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-ink-muted">
              <i className="ph-fill ph-lock-simple" />
              <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
                {workspace.site.slug}.com
              </span>
              <b>Preview</b>
            </div>
            <Button
              unstyled
              className={refreshing ? "spin" : ""}
              onClick={refresh}
              title="Refresh preview"
              type="button"
            >
              <i className="ph ph-arrow-clockwise" />
            </Button>
            <Button unstyled title="Open preview" type="button">
              <i className="ph ph-arrow-square-out" />
            </Button>
          </div>
          <div className="sf-navigation-stage sf-scroll [display:flex] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [align-items:flex-start] [justify-content:flex-start] [overflow:auto] [padding:24px] dark:[border-color:#323841] dark:[background:#15181c] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            <div
              className={`sf-site-preview [flex:none] [overflow:hidden] [border-radius:10px] bg-surface [box-shadow:0_14px_34px_rgb(23_35_38_/_10%)] [transition:width_200ms_ease] dark:[color:#141a2e] dark:[box-shadow:0_16px_42px_rgb(0_0_0_/_32%)] dark:[outline:1px_solid_#323841] [&.desktop]:[width:100%] [&.desktop]:[min-width:720px] [&.mobile]:[width:390px] [&.tablet]:[width:800px] ${device}`}
            >
              {isFooter ? (
                <FooterPreview
                  device={device}
                  items={items}
                  onSelect={selectItem}
                  selected={selected}
                />
              ) : (
                <HeaderPreview
                  device={device}
                  items={items}
                  mobileGroups={mobileGroups}
                  mobileOpen={mobileOpen}
                  onGroupToggle={(id) =>
                    setMobileGroups((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onMobileToggle={() => setMobileOpen((value) => !value)}
                  onPreviewGroup={setPreviewGroup}
                  onSelect={selectItem}
                  previewGroup={previewGroup}
                  selected={selected}
                />
              )}
            </div>
          </div>
        </section>

        <aside className="sf-navigation-builder [display:flex] [width:404px] [flex:0_0_404px] [flex-direction:column] bg-surface max-[980px]:[width:360px] max-[980px]:[flex-basis:360px] max-[760px]:[min-height:52%] max-[760px]:[width:100%] max-[760px]:[flex:1] dark:[border-color:#323841] dark:[background:#1d2126]">
          <div className="sf-builder-head [display:flex] [height:45px] [flex:none] [align-items:center] [gap:9px] [padding:0_16px] [border-bottom:1px_solid_var(--sf-sunken)] dark:[border-color:#323841] [&_small]:[display:inline-flex] [&_small]:[align-items:center] [&_small]:[gap:5px] [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[font-size:13.5px] [&>span:not(.sf-spacer)]:[font-size:11.5px] [&>span:not(.sf-spacer)]:[color:#a5b0ad] dark:[&>span:not(.sf-spacer)]:[color:#79808b]">
            <strong>{isFooter ? "Footer content" : "Menu structure"}</strong>
            <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
              {items.length} items
            </span>
            <span className="sf-spacer [flex:1]" />
            <small>
              <i className="ph ph-arrows-out-cardinal" /> Drag to reorder
            </small>
          </div>
          <div className="sf-builder-scroll sf-scroll [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [padding:14px_16px_80px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            {items.length ? (
              <div className="sf-menu-items [display:flex] [flex-direction:column] [gap:9px]">
                {items.map((item, index) => (
                  <MenuCard
                    broken={
                      (item.targetType === "page" &&
                        item.kind !== "group" &&
                        !livePaths.has(item.target)) ||
                      item.children.some(
                        (child) => child.targetType === "page" && !livePaths.has(child.target),
                      )
                    }
                    drop={dropId === item.id}
                    expanded={expanded.has(item.id)}
                    index={index}
                    item={item}
                    key={item.id}
                    location={location}
                    onAddChild={() => addChild(item.id)}
                    onChildMove={(id, direction) => moveChild(item.id, id, direction)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropId(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropId(item.id);
                    }}
                    onDragStart={(event) => {
                      setDragId(item.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDrop={() => onDrop(item.id)}
                    onMove={(direction) => moveTop(item.id, direction)}
                    onRemove={removeItem}
                    onSelect={() => selectItem(item.id)}
                    onToggle={() => {
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                      setSelected(item.id);
                    }}
                    onUpdate={updateItem}
                    pageOptions={workspace.pageOptions}
                    selected={
                      selected === item.id || item.children.some((child) => child.id === selected)
                    }
                    total={items.length}
                  />
                ))}
              </div>
            ) : (
              <div className="sf-builder-empty [display:flex] [flex-direction:column] [align-items:center] [gap:10px] [border-radius:12px] [padding:30px_20px] [text-align:center] [background:#fafcfa] [border:1.5px_dashed_#dce3de] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:[line-height:1.5] [&_p]:text-ink-subtle dark:[&_p]:[color:#79808b] [&_strong]:[font-size:14px] [&>span]:[display:grid] [&>span]:[height:44px] [&>span]:[width:44px] [&>span]:[place-items:center] [&>span]:[border-radius:11px] [&>span]:bg-selection [&>span]:[font-size:22px] [&>span]:text-action">
                <span>
                  <i className={`ph ${isFooter ? "ph-columns" : "ph-list-plus"}`} />
                </span>
                <strong>{isFooter ? "Build your site footer" : "Build your primary menu"}</strong>
                <p>Add links, groups, and a call-to-action. You can reorder everything later.</p>
              </div>
            )}
            <div className="sf-add-navigation [position:relative] [margin-top:10px] [&>button]:[display:inline-flex] [&>button]:[height:44px] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[justify-content:center] [&>button]:[gap:7px] [&>button]:[border-radius:10px] [&>button]:[font-size:13px] [&>button]:[font-weight:600] [&>button]:text-action [&>button]:[background:#fafcfa] [&>button]:[border:1.5px_dashed_#c2ccc4] dark:[&>button]:[border-color:#3d444e] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#1d2126] [&>button:hover]:border-selection-border [&>button:hover]:bg-selection dark:[&>button:hover]:[color:#b994f8] dark:[&>button:hover]:[background:#2c333b]">
              <Button unstyled onClick={() => setAddOpen((value) => !value)} type="button">
                <i className="ph-bold ph-plus" /> {isFooter ? "Add to footer" : "Add menu item"}
              </Button>
              {addOpen ? (
                <div className="sf-add-navigation-menu [position:absolute] [right:0] [bottom:50px] [left:0] [z-index:10] [display:grid] [gap:3px] [border-radius:10px] bg-surface [padding:7px] [box-shadow:0_16px_36px_rgb(23_35_38_/_18%)] [border:1px_solid_#dce3de] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_small]:[font-size:11px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[font-size:12.5px] [&>button]:[display:flex] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[gap:11px] [&>button]:[border-radius:7px] [&>button]:[padding:9px] [&>button]:[text-align:left] [&>button]:[background:transparent] [&>button]:[border:0] [&>button:hover]:bg-canvas dark:[&>button:hover]:[background:#242930] [&>button>span.button]:bg-clay-soft [&>button>span.button]:text-clay-dark [&>button>span.group]:[color:#5b4b8a] [&>button>span.group]:[background:#ede7f5] [&>button>span:first-child]:[display:grid] [&>button>span:first-child]:[height:32px] [&>button>span:first-child]:[width:32px] [&>button>span:first-child]:[flex:none] [&>button>span:first-child]:[place-items:center] [&>button>span:first-child]:[border-radius:8px] [&>button>span:first-child]:bg-selection [&>button>span:first-child]:text-action [&>button>span:last-child]:[display:flex] [&>button>span:last-child]:[flex-direction:column]">
                  {(
                    (isFooter
                      ? [
                          ["group", false, "Link column", "A titled column of links", "ph-columns"],
                          [
                            "link",
                            false,
                            "Link to a page",
                            "A standalone or legal link",
                            "ph-link-simple",
                          ],
                          [
                            "link",
                            true,
                            "Custom URL",
                            "Link to any external address",
                            "ph-arrow-square-out",
                          ],
                          [
                            "button",
                            false,
                            "Button",
                            "A highlighted call-to-action",
                            "ph-cursor-click",
                          ],
                        ]
                      : [
                          [
                            "link",
                            false,
                            "Link to a page",
                            "Point to a page in this site",
                            "ph-link-simple",
                          ],
                          [
                            "link",
                            true,
                            "Custom URL",
                            "Link to any external address",
                            "ph-arrow-square-out",
                          ],
                          [
                            "group",
                            false,
                            "Dropdown",
                            "A group with nested links",
                            "ph-caret-circle-down",
                          ],
                          [
                            "button",
                            false,
                            "Button",
                            "A highlighted call-to-action",
                            "ph-cursor-click",
                          ],
                        ]) as [NavigationKind, boolean, string, string, string][]
                  ).map(([kind, external, label, description, icon]) => (
                    <Button
                      unstyled
                      key={label}
                      onClick={() => addItem(kind, external)}
                      type="button"
                    >
                      <span className={kind as string}>
                        <i className={`ph ${icon}`} />
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            {error ? (
              <p className="sf-navigation-error [border-radius:8px] bg-danger-soft [padding:10px] [font-size:12px] text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <Modal
        open={publishConfirm}
        onOpenChange={setPublishConfirm}
        className="!w-[min(460px,100%)]"
      >
        <div className="sf-modal-head dark:[border-color:#323841]">
          <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-danger-soft text-[19px] text-danger">
            <i className="ph-fill ph-warning" />
          </span>
          <div>
            <ModalTitle>Publish with broken links?</ModalTitle>
            <ModalDescription>
              {brokenItems.length} {brokenItems.length === 1 ? "link points" : "links point"} to
              pages that do not exist.
            </ModalDescription>
          </div>
        </div>
        <div className="sf-publish-warning-list [display:grid] [max-height:240px] [gap:6px] [overflow:auto] [padding:16px_22px] [&_div]:[display:flex] [&_div]:[flex-direction:column] [&_div]:[gap:2px] [&_div]:[border-radius:7px] [&_div]:bg-danger-soft [&_div]:[padding:9px_10px] [&_span]:[font-size:11px] [&_span]:text-danger [&_strong]:[font-size:12px]">
          {brokenItems.map((item) => (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <span className="sf-mono [font-family:'Geist_Mono',_monospace]">{item.target}</span>
            </div>
          ))}
        </div>
        <div className="sf-modal-actions dark:[border-color:#323841] dark:[background:#242930]">
          <ModalClose className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]">
            Keep editing
          </ModalClose>
          <Button
            unstyled
            className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
            disabled={saving}
            loading={savingAction === "publish"}
            onClick={() => void publish()}
            type="button"
          >
            Publish anyway
          </Button>
        </div>
      </Modal>

      {toast ? (
        <div
          className="fixed bottom-[26px] left-1/2 z-[70] flex -translate-x-1/2 animate-in items-center gap-2.5 rounded-[11px] bg-ink px-4 py-3 text-[13px] text-white shadow-[0_14px_40px_rgb(23_35_38_/_32%)] duration-200 fade-in-0 slide-in-from-bottom-2 dark:border dark:border-field dark:bg-sunken dark:text-ink [&_i]:text-lg [&_i]:text-[#b994f8]"
          role="status"
        >
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function MenuCard({
  item,
  index,
  total,
  selected,
  expanded,
  broken,
  drop,
  location,
  pageOptions,
  onSelect,
  onToggle,
  onUpdate,
  onMove,
  onChildMove,
  onAddChild,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  item: NavigationItem;
  index: number;
  total: number;
  selected: boolean;
  expanded: boolean;
  broken: boolean;
  drop: boolean;
  location: NavigationLocation;
  pageOptions: { id: string; title: string; path: string }[];
  onSelect: () => void;
  onToggle: () => void;
  onUpdate: (id: string, patch: Partial<NavigationItem>) => void;
  onMove: (direction: -1 | 1) => void;
  onChildMove: (id: string, direction: -1 | 1) => void;
  onAddChild: () => void;
  onRemove: (id: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const theme = itemTheme[item.kind];
  return (
    <div
      className={cn(
        "sf-menu-card [overflow:hidden] [border-radius:10px] bg-surface [border:1px_solid_#dce3de] [transition:border-color_120ms,_box-shadow_120ms] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&.drop]:[border-top:3px_solid_var(--sf-accent)] [&.selected]:border-selection-border [&.selected]:[box-shadow:0_0_0_1px_var(--sf-selection-border)] dark:[&.selected]:[border-color:#515a65] dark:[&.selected]:[box-shadow:0_0_0_1px_#515a65]",
        selected && "selected",
        drop && "drop",
      )}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <div className="sf-menu-card-head [display:flex] [min-height:52px] [cursor:pointer] [align-items:center] [gap:9px] [padding:9px_10px_9px_8px] [&_.ph-caret-down]:[transition:transform_150ms] [&_.ph-caret-down.open]:[transform:rotate(180deg)] [&>button:not(.sf-menu-card-copy)]:[display:grid] [&>button:not(.sf-menu-card-copy)]:[height:24px] [&>button:not(.sf-menu-card-copy)]:[width:24px] [&>button:not(.sf-menu-card-copy)]:[flex:none] [&>button:not(.sf-menu-card-copy)]:[cursor:pointer] [&>button:not(.sf-menu-card-copy)]:[place-items:center] [&>button:not(.sf-menu-card-copy)]:[border-radius:6px] [&>button:not(.sf-menu-card-copy)]:[padding:0] [&>button:not(.sf-menu-card-copy)]:[color:#8b9b97] [&>button:not(.sf-menu-card-copy)]:[background:transparent] [&>button:not(.sf-menu-card-copy)]:[border:0] [&>button:not(.sf-menu-card-copy):disabled]:[cursor:default] [&>button:not(.sf-menu-card-copy):disabled]:[color:#d7ddda] [&>button:not(.sf-menu-card-copy):hover]:bg-sunken dark:[&>button:not(.sf-menu-card-copy):hover]:[background:#242930]">
        <i className="ph ph-dots-six-vertical sf-drag-handle [cursor:grab] [color:#b3beb9]" />
        <span
          className="sf-menu-kind [display:grid] [height:26px] [width:26px] [flex:none] [place-items:center] [border-radius:7px] bg-selection text-action"
          style={{ background: theme.bg, color: theme.fg }}
        >
          <i className={`ph ${theme.icon}`} />
        </span>
        <Button
          unstyled
          className="sf-menu-card-copy [display:flex] [min-width:0] [flex:1] [flex-direction:column] [&_small]:[overflow:hidden] [&_small]:[font-size:10.5px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:#9aa8a4] dark:[&_small]:[color:#79808b] [&_strong]:[overflow:hidden] [&_strong]:[font-size:13px] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap]"
          onClick={onSelect}
          type="button"
        >
          <strong>{item.label || "Untitled item"}</strong>
          <small className="sf-mono [font-family:'Geist_Mono',_monospace]">
            {item.kind === "group"
              ? `${location === "footer" ? "Column" : "Dropdown"} · ${item.children.length} ${item.children.length === 1 ? "link" : "links"}`
              : `${item.kind === "button" ? "Button · " : ""}${item.target}`}
          </small>
        </Button>
        {broken ? (
          <i
            className="ph-fill ph-warning sf-menu-warning [font-size:14px] text-danger"
            title="One or more target pages do not exist"
          />
        ) : null}
        <Button
          unstyled
          disabled={index === 0}
          onClick={(event) => {
            event.stopPropagation();
            onMove(-1);
          }}
          title="Move up"
          type="button"
        >
          <i className="ph-bold ph-arrow-up" />
        </Button>
        <Button
          unstyled
          disabled={index === total - 1}
          onClick={(event) => {
            event.stopPropagation();
            onMove(1);
          }}
          title="Move down"
          type="button"
        >
          <i className="ph-bold ph-arrow-down" />
        </Button>
        <Button
          unstyled
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          title={expanded ? "Collapse" : "Expand"}
          type="button"
        >
          <i className={cn("ph ph-caret-down", expanded && "open")} />
        </Button>
      </div>
      {expanded ? (
        <div className="sf-menu-card-fields [display:flex] [flex-direction:column] [gap:13px] [padding:13px_14px_14px] [background:#fafcfa] [border-top:1px_solid_var(--sf-sunken)] dark:[border-color:#323841] dark:[background:#242930]">
          <label
            className="sf-builder-field [display:flex] [flex-direction:column] [gap:5px] [&_input]:[height:36px] [&_input]:[width:100%] [&_input]:[border-radius:7px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:12.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:12.5px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]"
            htmlFor={`navigation-label-${item.id}`}
          >
            <span>Label</span>
            <Input
              unstyled
              id={`navigation-label-${item.id}`}
              value={item.label}
              onChange={(event) => onUpdate(item.id, { label: event.target.value })}
            />
          </label>
          {item.kind === "group" ? (
            <div className="sf-child-links [display:flex] [flex-direction:column] [gap:7px] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]">
              <span>
                {location === "footer" ? "Links in this column" : "Links in this dropdown"}
              </span>
              {item.children.map((child, childIndex) => (
                <div
                  className="sf-child-link [display:flex] [align-items:center] [gap:7px] [border-radius:9px] bg-surface [padding:7px_8px] [border:1px_solid_#e7ece8] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_input]:[height:30px] [&_input]:[width:100%] [&_input]:[border-radius:7px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:11.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&_select]:[height:30px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:11.5px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&>button]:[display:grid] [&>button]:[height:24px] [&>button]:[width:24px] [&>button]:[flex:none] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:6px] [&>button]:[padding:0] [&>button]:[color:#8b9b97] [&>button]:[background:transparent] [&>button]:[border:0] [&>button:disabled]:[cursor:default] [&>button:disabled]:[color:#d7ddda] [&>button:hover]:bg-sunken dark:[&>button:hover]:[background:#242930] [&>div]:[display:grid] [&>div]:[min-width:0] [&>div]:[flex:1] [&>div]:[grid-template-columns:1fr] [&>div]:[gap:5px]"
                  key={child.id}
                >
                  <span className="sf-menu-kind [display:grid] [height:26px] [width:26px] [flex:none] [place-items:center] [border-radius:7px] bg-selection text-action">
                    <i className="ph ph-link-simple" />
                  </span>
                  <div>
                    <Input
                      unstyled
                      aria-label="Link label"
                      value={child.label}
                      onChange={(event) => onUpdate(child.id, { label: event.target.value })}
                    />
                    <NativeSelect
                      unstyled
                      aria-label="Link target"
                      value={child.target}
                      onChange={(event) =>
                        onUpdate(child.id, {
                          target: event.target.value,
                          targetType: "page",
                        })
                      }
                    >
                      {!pageOptions.some((page) => page.path === child.target) ? (
                        <option value={child.target}>{child.target} (missing)</option>
                      ) : null}
                      {pageOptions.map((page) => (
                        <option key={page.id} value={page.path}>
                          {page.title} · {page.path}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button
                    unstyled
                    disabled={childIndex === 0}
                    onClick={() => onChildMove(child.id, -1)}
                    title="Move up"
                    type="button"
                  >
                    <i className="ph-bold ph-arrow-up" />
                  </Button>
                  <Button
                    unstyled
                    disabled={childIndex === item.children.length - 1}
                    onClick={() => onChildMove(child.id, 1)}
                    title="Move down"
                    type="button"
                  >
                    <i className="ph-bold ph-arrow-down" />
                  </Button>
                  <Button
                    unstyled
                    onClick={() => onRemove(child.id)}
                    title="Remove link"
                    type="button"
                  >
                    <i className="ph ph-x" />
                  </Button>
                </div>
              ))}
              <Button
                unstyled
                className="sf-add-child [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [justify-content:center] [gap:6px] [border-radius:9px] bg-surface [font-size:12.5px] [font-weight:600] text-action [border:1.5px_dashed_#c2ccc4] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:border-selection-border [&:hover]:bg-selection dark:[&:hover]:[color:#b994f8] dark:[&:hover]:[background:#2c333b]"
                onClick={onAddChild}
                type="button"
              >
                <i className="ph-bold ph-plus" /> Add link to{" "}
                {location === "footer" ? "column" : "dropdown"}
              </Button>
            </div>
          ) : (
            <>
              <div className="sf-link-type [display:flex] [align-items:center] [gap:10px] [&_button]:[height:26px] [&_button]:[cursor:pointer] [&_button]:[border-radius:5px] [&_button]:[padding:0_10px] [&_button]:[font-size:11.5px] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] dark:[&_button]:[color:#a7aeb8] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgb(23_35_38_/_10%)] dark:[&_button.active]:[color:#b994f8] dark:[&_button.active]:[box-shadow:none] dark:[&_button.active]:[background:#2c333b] [&>div]:[display:flex] [&>div]:[border-radius:7px] [&>div]:bg-sunken [&>div]:[padding:2px] dark:[&>div]:[background:#15181c] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]">
                <span>Links to</span>
                <div>
                  <Button
                    unstyled
                    className={item.targetType === "page" ? "active" : ""}
                    onClick={() =>
                      onUpdate(item.id, {
                        targetType: "page",
                        target: pageOptions[0]?.path ?? "/",
                      })
                    }
                    type="button"
                  >
                    Page
                  </Button>
                  <Button
                    unstyled
                    className={item.targetType === "url" ? "active" : ""}
                    onClick={() =>
                      onUpdate(item.id, {
                        targetType: "url",
                        target: "https://",
                      })
                    }
                    type="button"
                  >
                    Custom URL
                  </Button>
                </div>
              </div>
              <label className="sf-builder-field [display:flex] [flex-direction:column] [gap:5px] [&_input]:[height:36px] [&_input]:[width:100%] [&_input]:[border-radius:7px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:12.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:12.5px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]">
                <span>{item.targetType === "page" ? "Page" : "URL"}</span>
                {item.targetType === "page" ? (
                  <NativeSelect
                    unstyled
                    value={item.target}
                    onChange={(event) => onUpdate(item.id, { target: event.target.value })}
                  >
                    {!pageOptions.some((page) => page.path === item.target) ? (
                      <option value={item.target}>{item.target} (missing)</option>
                    ) : null}
                    {pageOptions.map((page) => (
                      <option key={page.id} value={page.path}>
                        {page.title} · {page.path}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    unstyled
                    className="sf-mono [font-family:'Geist_Mono',_monospace]"
                    value={item.target}
                    onChange={(event) => onUpdate(item.id, { target: event.target.value })}
                  />
                )}
              </label>
              <label className="sf-new-tab [display:flex] [cursor:pointer] [align-items:center] [gap:8px] [font-size:12px] text-ink-muted dark:[color:#a7aeb8] [&_input]:[height:16px] [&_input]:[width:16px] [&_input]:[accent-color:var(--sf-accent)]">
                <Input
                  unstyled
                  checked={item.newTab}
                  onChange={(event) => onUpdate(item.id, { newTab: event.target.checked })}
                  type="checkbox"
                />{" "}
                Open in a new tab
              </label>
            </>
          )}
          <div className="sf-card-bottom [display:flex] [align-items:center] [padding-top:3px] [&>span_i]:text-action [&>span:not(.sf-spacer)]:[display:inline-flex] [&>span:not(.sf-spacer)]:[align-items:center] [&>span:not(.sf-spacer)]:[gap:5px] [&>span:not(.sf-spacer)]:[font-size:11.5px] [&>span:not(.sf-spacer)]:text-ink-subtle dark:[&>span:not(.sf-spacer)]:[color:#79808b]">
            {item.kind === "button" ? (
              <span>
                <i className="ph-fill ph-cursor-click" /> Shown as a button
              </span>
            ) : null}
            <span className="sf-spacer [flex:1]" />
            <Button
              unstyled
              className="sf-remove-item [display:inline-flex] [height:30px] [cursor:pointer] [align-items:center] [gap:6px] [border-radius:7px] bg-surface [padding:0_11px] [font-size:12px] [font-weight:600] text-danger [border:1px_solid_#eec6bc] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:bg-danger-soft"
              onClick={() => onRemove(item.id)}
              type="button"
            >
              <i className="ph ph-trash" /> Remove {location === "footer" ? "item" : "menu item"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderPreview({
  items,
  device,
  selected,
  previewGroup,
  mobileOpen,
  mobileGroups,
  onSelect,
  onPreviewGroup,
  onMobileToggle,
  onGroupToggle,
}: {
  items: NavigationItem[];
  device: Device;
  selected: string | null;
  previewGroup: string | null;
  mobileOpen: boolean;
  mobileGroups: Set<string>;
  onSelect: (id: string) => void;
  onPreviewGroup: (id: string | null) => void;
  onMobileToggle: () => void;
  onGroupToggle: (id: string) => void;
}) {
  if (device === "mobile") {
    return (
      <div className="sf-mobile-header-preview [min-height:420px] [&_.ph-caret-down]:[transition:transform_150ms_ease] [&_.ph-caret-down.open]:[transform:rotate(180deg)] [&_nav]:[display:flex] [&_nav]:[flex-direction:column] [&_nav]:[gap:3px] [&_nav]:[padding:12px] [&_nav_button]:[display:flex] [&_nav_button]:[height:48px] [&_nav_button]:[cursor:pointer] [&_nav_button]:[align-items:center] [&_nav_button]:[justify-content:space-between] [&_nav_button]:[border-radius:9px] [&_nav_button]:[padding:0_13px] [&_nav_button]:[text-align:left] [&_nav_button]:[font-size:15px] [&_nav_button]:[color:#141a2e] [&_nav_button]:[background:transparent] [&_nav_button]:[border:0] [&_nav_button.child]:[height:42px] [&_nav_button.child]:[padding-left:24px] [&_nav_button.child]:[color:#4a5064] [&_nav_button.cta]:[margin-top:8px] [&_nav_button.cta]:[justify-content:center] [&_nav_button.cta]:[font-weight:600] [&_nav_button.cta]:[color:#fff] [&_nav_button.cta]:[background:#2f5fe0] [&_nav_button.selected]:bg-selection [&_nav_button.selected]:[box-shadow:inset_0_0_0_1.5px_var(--sf-selection-rail)] [&>.sf-preview-brand]:[height:58px] [&>.sf-preview-brand]:[padding:0_18px] [&>.sf-preview-brand]:[border-bottom:1px_solid_#edeff2] [&>.sf-preview-brand_button]:[display:grid] [&>.sf-preview-brand_button]:[height:38px] [&>.sf-preview-brand_button]:[width:38px] [&>.sf-preview-brand_button]:[cursor:pointer] [&>.sf-preview-brand_button]:[place-items:center] [&>.sf-preview-brand_button]:[border-radius:9px] [&>.sf-preview-brand_button]:[font-size:22px] [&>.sf-preview-brand_button]:[background:transparent] [&>.sf-preview-brand_button]:[border:0]">
        <div className="sf-preview-brand [display:flex] [flex:none] [align-items:center] [gap:9px] [&_strong]:[font-size:16px] [&_strong]:[font-weight:700]">
          <Logo /> <strong>Acme</strong>
          <span className="sf-spacer [flex:1]" />
          <Button unstyled onClick={onMobileToggle} type="button">
            <i className={`ph-bold ${mobileOpen ? "ph-x" : "ph-list"}`} />
          </Button>
        </div>
        {mobileOpen ? (
          <nav>
            {items.map((item) =>
              item.kind === "group" ? (
                <div key={item.id}>
                  <Button
                    unstyled
                    className={selected === item.id ? "selected" : ""}
                    onClick={() => {
                      onSelect(item.id);
                      onGroupToggle(item.id);
                    }}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <i
                      className={cn("ph-bold ph-caret-down", mobileGroups.has(item.id) && "open")}
                    />
                  </Button>
                  {mobileGroups.has(item.id)
                    ? item.children.map((child) => (
                        <Button
                          unstyled
                          className={cn("child", selected === child.id && "selected")}
                          key={child.id}
                          onClick={() => onSelect(child.id)}
                          type="button"
                        >
                          {child.label}
                        </Button>
                      ))
                    : null}
                </div>
              ) : (
                <Button
                  unstyled
                  className={cn(
                    item.kind === "button" && "cta",
                    selected === item.id && "selected",
                  )}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  {item.label}
                </Button>
              ),
            )}
          </nav>
        ) : null}
      </div>
    );
  }
  return (
    <div className="sf-desktop-header-preview [position:relative] [min-height:252px] [&_nav_button]:[cursor:pointer] [&_nav_button]:[background:transparent] [&_nav_button]:[border:0] [&>header]:[display:flex] [&>header]:[height:66px] [&>header]:[align-items:center] [&>header]:[gap:28px] [&>header]:[padding:0_28px] [&>header]:[border-bottom:1px_solid_#edeff2] [&>header_nav]:[display:flex] [&>header_nav]:[min-width:0] [&>header_nav]:[flex:1] [&>header_nav]:[align-items:center] [&>header_nav]:[justify-content:flex-end] [&>header_nav]:[gap:4px] [&>header_nav]:[overflow-x:auto] [&>header_nav_button]:[display:inline-flex] [&>header_nav_button]:[height:38px] [&>header_nav_button]:[flex:none] [&>header_nav_button]:[align-items:center] [&>header_nav_button]:[gap:5px] [&>header_nav_button]:[border-radius:8px] [&>header_nav_button]:[padding:0_13px] [&>header_nav_button]:[font-size:14px] [&>header_nav_button]:[font-weight:500] [&>header_nav_button]:[white-space:nowrap] [&>header_nav_button]:[color:#141a2e] [&>header_nav_button.cta]:[margin-left:10px] [&>header_nav_button.cta]:[padding:0_17px] [&>header_nav_button.cta]:[font-weight:600] [&>header_nav_button.cta]:[color:#fff] [&>header_nav_button.cta]:[background:#2f5fe0] [&>header_nav_button.selected]:bg-selection [&>header_nav_button.selected]:[box-shadow:inset_0_0_0_1.5px_var(--sf-selection-rail)]">
      <header>
        <div className="sf-preview-brand [display:flex] [flex:none] [align-items:center] [gap:9px] [&_strong]:[font-size:16px] [&_strong]:[font-weight:700]">
          <Logo />
          <strong>Acme</strong>
        </div>
        <nav className="sf-scroll [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
          {items.map((item) => (
            <Button
              unstyled
              className={cn(item.kind === "button" && "cta", selected === item.id && "selected")}
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                if (item.kind === "group")
                  onPreviewGroup(previewGroup === item.id ? null : item.id);
              }}
              type="button"
            >
              {item.label}
              {item.kind === "group" ? <i className="ph-bold ph-caret-down" /> : null}
            </Button>
          ))}
        </nav>
      </header>
      {previewGroup ? (
        <div className="sf-preview-dropdown [position:absolute] [top:58px] [right:120px] [z-index:4] [display:grid] [width:230px] [gap:2px] [border-radius:10px] bg-surface [padding:8px] [box-shadow:0_14px_32px_rgb(23_35_38_/_15%)] [border:1px_solid_var(--sf-border)] [&_button]:[display:flex] [&_button]:[cursor:pointer] [&_button]:[flex-direction:column] [&_button]:[gap:2px] [&_button]:[border-radius:7px] [&_button]:[padding:9px_10px] [&_button]:[text-align:left] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.selected]:bg-selection [&_button:hover]:bg-selection [&_span]:[font-size:10px] [&_span]:text-ink-subtle">
          {items
            .find((item) => item.id === previewGroup)
            ?.children.map((child) => (
              <Button
                unstyled
                className={selected === child.id ? "selected" : ""}
                key={child.id}
                onClick={() => onSelect(child.id)}
                type="button"
              >
                {child.label}
                <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
                  {child.target}
                </span>
              </Button>
            ))}
        </div>
      ) : null}
      <PreviewSkeleton />
    </div>
  );
}

function FooterPreview({
  items,
  device,
  selected,
  onSelect,
}: {
  items: NavigationItem[];
  device: Device;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = items.filter((item) => item.kind === "group");
  const buttons = items.filter((item) => item.kind === "button");
  const links = items.filter((item) => item.kind === "link");
  return (
    <div
      className={`sf-footer-preview [min-height:458px] [&_.sf-preview-skeleton]:[min-height:124px] [&_footer]:[margin:0] [&_footer]:[padding:38px_40px_26px] [&_footer]:[color:#fff] [&_footer]:[background:#141a2e] [&.mobile_.sf-footer-bottom]:[flex-direction:column] [&.mobile_.sf-footer-bottom]:[align-items:flex-start] [&.mobile_.sf-footer-bottom_nav]:[margin-left:0] [&.mobile_.sf-footer-main]:[display:flex] [&.mobile_.sf-footer-main]:[flex-direction:column] [&.mobile_.sf-footer-main]:[gap:28px] [&.mobile_footer]:[padding:30px_26px] ${device}`}
    >
      <PreviewSkeleton />
      <footer>
        <div className="sf-footer-main [display:grid] [grid-template-columns:minmax(230px,_1.3fr)_repeat(3,_1fr)] [gap:38px]">
          <div className="sf-footer-brand [display:flex] [flex-direction:column] [align-items:flex-start] [gap:16px] [&_p]:[margin:0] [&_p]:[max-width:290px] [&_p]:[font-size:13px] [&_p]:[line-height:1.6] [&_p]:[color:#aeb4c6] [&>button]:[height:40px] [&>button]:[cursor:pointer] [&>button]:[border-radius:9px] [&>button]:[padding:0_18px] [&>button]:[font-weight:600] [&>button]:[color:#fff] [&>button]:[background:#2f5fe0] [&>button]:[border:1.5px_solid_#2f5fe0] [&>button.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&>button.selected]:[background:rgb(78_123_240_/_20%)]">
            <div className="sf-preview-brand [display:flex] [flex:none] [align-items:center] [gap:9px] [&_strong]:[font-size:16px] [&_strong]:[font-weight:700]">
              <Logo />
              <strong>Acme</strong>
            </div>
            <p>The website-native, open-source CMS for teams who care about their URLs.</p>
            <div className="sf-socials [display:flex] [gap:8px] [&_i]:[display:grid] [&_i]:[height:32px] [&_i]:[width:32px] [&_i]:[place-items:center] [&_i]:[border-radius:8px] [&_i]:[color:#aeb4c6] [&_i]:[background:rgb(255_255_255_/_8%)]">
              <i className="ph ph-x-logo" />
              <i className="ph ph-github-logo" />
              <i className="ph ph-linkedin-logo" />
            </div>
            {buttons.map((item) => (
              <Button
                unstyled
                className={selected === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                {item.label}
              </Button>
            ))}
          </div>
          {groups.map((group) => (
            <div
              className={cn(
                "sf-footer-column [display:flex] [flex-direction:column] [align-items:flex-start] [gap:10px] [border-radius:8px] [padding:5px] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[color:#aeb4c6] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&_button.selected]:[background:rgb(78_123_240_/_20%)] [&.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&.selected]:[background:rgb(78_123_240_/_20%)] [&>strong]:[margin-bottom:3px] [&>strong]:[font-size:12px] [&>strong]:[font-weight:500] [&>strong]:[letter-spacing:0.04em] [&>strong]:[color:#9eb5f0] [&>strong]:[text-transform:uppercase]",
                selected === group.id && "selected",
              )}
              key={group.id}
            >
              <Button unstyled onClick={() => onSelect(group.id)} type="button">
                <strong>{group.label}</strong>
              </Button>
              {group.children.map((child) => (
                <Button
                  unstyled
                  className={selected === child.id ? "selected" : ""}
                  key={child.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(child.id);
                  }}
                  type="button"
                >
                  {child.label}
                </Button>
              ))}
            </div>
          ))}
        </div>
        <div className="sf-footer-bottom [margin-top:28px] [display:flex] [align-items:center] [gap:16px] [padding-top:22px] [font-size:12px] [color:#8891a6] [border-top:1px_solid_rgb(255_255_255_/_12%)] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[color:#aeb4c6] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&_button.selected]:[background:rgb(78_123_240_/_20%)] [&_nav]:[margin-left:auto] [&_nav]:[display:flex] [&_nav]:[gap:24px]">
          <span>© 2026 Acme Marketing. All rights reserved.</span>
          <nav>
            {links.map((item) => (
              <Button
                unstyled
                className={selected === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="sf-preview-logo [display:grid] [height:28px] [width:28px] [place-items:center] [border-radius:7px] bg-clay [color:#fff]">
      <i className="ph-bold ph-hammer" />
    </span>
  );
}

function PreviewSkeleton() {
  return (
    <div className="sf-preview-skeleton [display:flex] [flex-direction:column] [gap:12px] [padding:40px_28px] [&_span]:[height:12px] [&_span]:[border-radius:999px] [&_span]:[background:#edf0f3] [&_span:nth-child(1)]:[width:42%] [&_span:nth-child(2)]:[width:70%] [&_span:nth-child(3)]:[width:55%]">
      <span />
      <span />
      <span />
    </div>
  );
}
