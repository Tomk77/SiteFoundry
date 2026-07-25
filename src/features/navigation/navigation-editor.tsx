import { LoadingSplash, RouteLoading } from "@/components/loading";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createNavigationItem,
  loadNavigationWorkspace,
  publishNavigation,
  saveNavigationDraft,
  type NavigationItem,
  type NavigationKind,
  type NavigationLocation,
  type NavigationWorkspace,
} from "@/lib/navigation";

import { MenuCard } from "./components/menu-card";
import { FooterPreview, HeaderPreview } from "./components/navigation-preview";
import { allItems, move, parentOf, type Device } from "./editor-model";

const navigationWorkspaceCache = new Map<string, NavigationWorkspace>();

export function NavigationEditor({ location }: { location: NavigationLocation }) {
  const navigate = useNavigate({
    from: location === "header" ? "/header-navigation" : "/footer",
  });
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
      <main className="sc-navigation-editor sc-navigation-loading [display:flex] [height:100vh] [width:100vw] [animation:sc-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-surface motion-reduce:[animation:none] dark:[color:#e9ecf1] dark:[background:#15181c] [&_.sc-route-loading]:[width:100%]">
        <header className="sc-navigation-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[background:#1d2126]">
          <Button
            unstyled
            className="sc-back-button [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:bg-canvas dark:[&:hover]:[background:#242930]"
            disabled
            type="button"
          >
            <i className="ph-bold ph-arrow-left" /> Back
          </Button>
          <div className="sc-navigation-title [display:grid] [grid-template-columns:auto_auto] [align-items:center] [gap:0_16px] [font-size:12px] max-[760px]:[display:flex] max-[760px]:[flex-direction:column] max-[760px]:[align-items:flex-start] max-[760px]:[gap:1px] [&>small]:[grid-column:1_/_-1] [&>small]:[font-size:11px] [&>small]:text-action [&>span]:text-ink-subtle max-[760px]:[&>span]:[display:none] [&>strong]:[font-weight:600]">
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
      <div className="sc-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
        {error || "No website is available."}
      </div>
    );

  return (
    <main className="sc-navigation-editor [display:flex] [height:100vh] [width:100vw] [animation:sc-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-surface motion-reduce:[animation:none] dark:[color:#e9ecf1] dark:[background:#15181c]">
      <header className="sc-navigation-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[background:#1d2126]">
        <Button
          unstyled
          className="sc-back-button [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:bg-canvas dark:[&:hover]:[background:#242930]"
          onClick={() => void navigate({ to: "/" })}
          type="button"
        >
          <i className="ph-bold ph-arrow-left" /> Back
        </Button>
        <div className="sc-navigation-title [display:grid] [grid-template-columns:auto_auto] [align-items:center] [gap:0_16px] [font-size:12px] max-[760px]:[display:flex] max-[760px]:[flex-direction:column] max-[760px]:[align-items:flex-start] max-[760px]:[gap:1px] [&>small]:[grid-column:1_/_-1] [&>small]:[font-size:11px] [&>small]:text-action [&>span]:text-ink-subtle max-[760px]:[&>span]:[display:none] [&>strong]:[font-weight:600]">
          <span>Navigation</span>
          <strong>{isFooter ? "Footer" : "Header"}</strong>
          <small className="sc-mono [font-family:'Geist_Mono',_monospace]">
            {isFooter ? "Site footer" : "Primary menu"} · {workspace.language.code.toUpperCase()}
          </small>
        </div>
        <span className={`sc-editor-status ${published ? "Published" : "Concept"}`}>
          {published ? "Published" : "Draft"}
        </span>
        {brokenItems.length ? (
          <span className="sc-navigation-broken [display:inline-flex] [height:22px] [align-items:center] [gap:5px] [border-radius:5px] bg-danger-soft [padding:0_8px] [font-size:11.5px] [font-weight:600] text-danger max-[760px]:[display:none]">
            <i className="ph-fill ph-warning" /> {brokenItems.length} broken{" "}
            {brokenItems.length === 1 ? "link" : "links"}
          </span>
        ) : null}
        <span className="sc-spacer [flex:1]" />
        <span className="sc-navigation-saved [display:inline-flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle max-[980px]:[display:none] dark:[color:#79808b] [&_.ph-spinner]:[animation:sc-navigation-spin_700ms_linear_infinite] [&_i]:[font-size:14px]">
          <i className={`ph ${saving ? "ph-spinner" : dirty ? "ph-cloud" : "ph-cloud-check"}`} />
          {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button
          unstyled
          className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={!dirty || saving}
          loading={savingAction === "draft"}
          onClick={() => void save()}
          type="button"
        >
          <i className="ph ph-floppy-disk" /> Save draft
        </Button>
        <Button
          unstyled
          className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={saving}
          loading={savingAction === "publish"}
          onClick={() => (brokenItems.length ? setPublishConfirm(true) : void publish())}
          type="button"
        >
          <i className="ph-bold ph-rocket-launch" /> Publish changes
        </Button>
      </header>

      <div className="sc-navigation-workspace [display:flex] [min-height:0] [flex:1] max-[760px]:[flex-direction:column]">
        <section className="sc-navigation-preview [display:flex] [min-width:0] [flex:1] [flex-direction:column] bg-sunken [border-right:1px_solid_var(--sc-border)] max-[760px]:[min-height:48%] max-[760px]:[border-bottom:1px_solid_var(--sc-border)] max-[760px]:[border-right:0] dark:[border-color:#323841] dark:[background:#15181c] [&_.sc-preview-tools]:[height:48px] [&_.sc-preview-tools]:[flex:none] [&_.sc-preview-tools]:[padding:0_16px] [&_.sc-preview-tools]:[background:#fafcfa] dark:[&_.sc-preview-tools]:[border-color:#323841] dark:[&_.sc-preview-tools]:[background:#1d2126] [&_.sc-preview-tools>button]:[display:grid] [&_.sc-preview-tools>button]:[height:32px] [&_.sc-preview-tools>button]:[width:32px] [&_.sc-preview-tools>button]:[cursor:pointer] [&_.sc-preview-tools>button]:[place-items:center] [&_.sc-preview-tools>button]:[border-radius:8px] [&_.sc-preview-tools>button]:[padding:0] [&_.sc-preview-tools>button]:text-ink-muted [&_.sc-preview-tools>button]:[background:transparent] [&_.sc-preview-tools>button]:[border:0] [&_.sc-preview-tools>button.spin_i]:[animation:sc-navigation-spin_500ms_linear] [&_.sc-preview-tools>button:hover]:bg-sunken [&_.sc-preview-tools>button:hover]:text-ink dark:[&_.sc-preview-tools>button:hover]:[color:#b994f8] dark:[&_.sc-preview-tools>button:hover]:[background:#2c333b]">
          <div className="sc-preview-tools flex h-12 shrink-0 items-center gap-3 border-b border-border bg-[#fafcfa] px-4 dark:bg-surface">
            <div className="sc-device-toggle flex gap-0.5 rounded-lg bg-[#eaeeea] p-0.5 dark:bg-canvas [&_button]:grid [&_button]:h-7 [&_button]:w-[30px] [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-base [&_button]:text-ink-subtle [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:shadow-[0_1px_2px_rgb(23_35_38_/_14%)] dark:[&_button.active]:bg-selection dark:[&_button.active]:text-action dark:[&_button.active]:shadow-none">
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
            <div className="sc-preview-url flex h-8 max-w-[440px] min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 dark:border-field [&>b]:rounded-full [&>b]:bg-concept-soft [&>b]:px-1.5 [&>b]:py-px [&>b]:text-[10px] [&>b]:text-concept [&>i]:text-xs [&>i]:text-published [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:font-mono [&>span]:text-xs [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-ink-muted">
              <i className="ph-fill ph-lock-simple" />
              <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
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
          <div className="sc-navigation-stage sc-scroll [display:flex] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [align-items:flex-start] [justify-content:flex-start] [overflow:auto] [padding:24px] dark:[border-color:#323841] dark:[background:#15181c] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            <div
              className={`sc-site-preview [flex:none] [overflow:hidden] [border-radius:10px] bg-surface [box-shadow:0_14px_34px_rgb(23_35_38_/_10%)] [transition:width_200ms_ease] dark:[color:#141a2e] dark:[box-shadow:0_16px_42px_rgb(0_0_0_/_32%)] dark:[outline:1px_solid_#323841] [&.desktop]:[width:100%] [&.desktop]:[min-width:720px] [&.mobile]:[width:390px] [&.tablet]:[width:800px] ${device}`}
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

        <aside className="sc-navigation-builder [display:flex] [width:404px] [flex:0_0_404px] [flex-direction:column] bg-surface max-[980px]:[width:360px] max-[980px]:[flex-basis:360px] max-[760px]:[min-height:52%] max-[760px]:[width:100%] max-[760px]:[flex:1] dark:[border-color:#323841] dark:[background:#1d2126]">
          <div className="sc-builder-head [display:flex] [height:45px] [flex:none] [align-items:center] [gap:9px] [padding:0_16px] [border-bottom:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] [&_small]:[display:inline-flex] [&_small]:[align-items:center] [&_small]:[gap:5px] [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[font-size:13.5px] [&>span:not(.sc-spacer)]:[font-size:11.5px] [&>span:not(.sc-spacer)]:[color:#a5b0ad] dark:[&>span:not(.sc-spacer)]:[color:#79808b]">
            <strong>{isFooter ? "Footer content" : "Menu structure"}</strong>
            <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
              {items.length} items
            </span>
            <span className="sc-spacer [flex:1]" />
            <small>
              <i className="ph ph-arrows-out-cardinal" /> Drag to reorder
            </small>
          </div>
          <div className="sc-builder-scroll sc-scroll [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [padding:14px_16px_80px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            {items.length ? (
              <div className="sc-menu-items [display:flex] [flex-direction:column] [gap:9px]">
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
              <div className="sc-builder-empty [display:flex] [flex-direction:column] [align-items:center] [gap:10px] [border-radius:12px] [padding:30px_20px] [text-align:center] [background:#fafcfa] [border:1.5px_dashed_#dce3de] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:[line-height:1.5] [&_p]:text-ink-subtle dark:[&_p]:[color:#79808b] [&_strong]:[font-size:14px] [&>span]:[display:grid] [&>span]:[height:44px] [&>span]:[width:44px] [&>span]:[place-items:center] [&>span]:[border-radius:11px] [&>span]:bg-selection [&>span]:[font-size:22px] [&>span]:text-action">
                <span>
                  <i className={`ph ${isFooter ? "ph-columns" : "ph-list-plus"}`} />
                </span>
                <strong>{isFooter ? "Build your site footer" : "Build your primary menu"}</strong>
                <p>Add links, groups, and a call-to-action. You can reorder everything later.</p>
              </div>
            )}
            <div className="sc-add-navigation [position:relative] [margin-top:10px] [&>button]:[display:inline-flex] [&>button]:[height:44px] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[justify-content:center] [&>button]:[gap:7px] [&>button]:[border-radius:10px] [&>button]:[font-size:13px] [&>button]:[font-weight:600] [&>button]:text-action [&>button]:[background:#fafcfa] [&>button]:[border:1.5px_dashed_#c2ccc4] dark:[&>button]:[border-color:#3d444e] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#1d2126] [&>button:hover]:border-selection-border [&>button:hover]:bg-selection dark:[&>button:hover]:[color:#b994f8] dark:[&>button:hover]:[background:#2c333b]">
              <Button unstyled onClick={() => setAddOpen((value) => !value)} type="button">
                <i className="ph-bold ph-plus" /> {isFooter ? "Add to footer" : "Add menu item"}
              </Button>
              {addOpen ? (
                <div className="sc-add-navigation-menu [position:absolute] [right:0] [bottom:50px] [left:0] [z-index:10] [display:grid] [gap:3px] [border-radius:10px] bg-surface [padding:7px] [box-shadow:0_16px_36px_rgb(23_35_38_/_18%)] [border:1px_solid_#dce3de] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_small]:[font-size:11px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[font-size:12.5px] [&>button]:[display:flex] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[gap:11px] [&>button]:[border-radius:7px] [&>button]:[padding:9px] [&>button]:[text-align:left] [&>button]:[background:transparent] [&>button]:[border:0] [&>button:hover]:bg-canvas dark:[&>button:hover]:[background:#242930] [&>button>span.button]:bg-clay-soft [&>button>span.button]:text-clay-dark [&>button>span.group]:[color:#5b4b8a] [&>button>span.group]:[background:#ede7f5] [&>button>span:first-child]:[display:grid] [&>button>span:first-child]:[height:32px] [&>button>span:first-child]:[width:32px] [&>button>span:first-child]:[flex:none] [&>button>span:first-child]:[place-items:center] [&>button>span:first-child]:[border-radius:8px] [&>button>span:first-child]:bg-selection [&>button>span:first-child]:text-action [&>button>span:last-child]:[display:flex] [&>button>span:last-child]:[flex-direction:column]">
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
              <p className="sc-navigation-error [border-radius:8px] bg-danger-soft [padding:10px] [font-size:12px] text-danger">
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
        <div className="sc-modal-head dark:[border-color:#323841]">
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
        <div className="sc-publish-warning-list [display:grid] [max-height:240px] [gap:6px] [overflow:auto] [padding:16px_22px] [&_div]:[display:flex] [&_div]:[flex-direction:column] [&_div]:[gap:2px] [&_div]:[border-radius:7px] [&_div]:bg-danger-soft [&_div]:[padding:9px_10px] [&_span]:[font-size:11px] [&_span]:text-danger [&_strong]:[font-size:12px]">
          {brokenItems.map((item) => (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <span className="sc-mono [font-family:'Geist_Mono',_monospace]">{item.target}</span>
            </div>
          ))}
        </div>
        <div className="sc-modal-actions dark:[border-color:#323841] dark:[background:#242930]">
          <ModalClose className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]">
            Keep editing
          </ModalClose>
          <Button
            unstyled
            className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
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
