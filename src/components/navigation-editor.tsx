import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { useNavigate } from "@tanstack/react-router";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
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
import "../redirects.css";
import "../navigation.css";

type Device = "desktop" | "tablet" | "mobile";

const itemTheme = {
  link: { icon: "ph-link-simple", bg: "#eceef1", fg: "#763fba" },
  group: { icon: "ph-columns", bg: "#EDE7F5", fg: "#5B4B8A" },
  button: { icon: "ph-cursor-click", bg: "#FBEBE1", fg: "#B45F38" },
} as const;

function move<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length)
    return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function allItems(items: NavigationItem[]) {
  return items.flatMap((item) => [item, ...item.children]);
}

function parentOf(items: NavigationItem[], childId: string) {
  return items.find((item) =>
    item.children.some((child) => child.id === childId),
  );
}

const navigationWorkspaceCache = new Map<string, NavigationWorkspace>();

export function NavigationEditor({
  location,
}: {
  location: NavigationLocation;
}) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const cacheKey = user ? `${user.id}:${location}` : "";
  const cachedWorkspace = cacheKey
    ? (navigationWorkspaceCache.get(cacheKey) ?? null)
    : null;
  const [workspace, setWorkspace] = useState<NavigationWorkspace | null>(
    cachedWorkspace,
  );
  const [items, setItems] = useState<NavigationItem[]>(
    cachedWorkspace?.items ?? [],
  );
  const [savedSnapshot, setSavedSnapshot] = useState(
    JSON.stringify(cachedWorkspace?.items ?? []),
  );
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
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFooter = location === "footer";
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
          item.kind !== "group" &&
          item.targetType === "page" &&
          !livePaths.has(item.target),
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
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load navigation.",
        ),
      )
      .finally(() => setLoading(false));
  }, [user?.id, location]);

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
        item.id === parentId
          ? { ...item, children: [...item.children, child] }
          : item,
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
    setSaving(true);
    setError("");
    try {
      await saveNavigationDraft(workspace.menuId, items);
      setSavedSnapshot(JSON.stringify(items));
      showToast(`${isFooter ? "Footer" : "Header navigation"} draft saved`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save draft.",
      );
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!workspace || saving) return;
    setSaving(true);
    setError("");
    try {
      await publishNavigation(workspace.menuId, items);
      const snapshot = JSON.stringify(items);
      setSavedSnapshot(snapshot);
      setPublishedSnapshot(snapshot);
      setPublishConfirm(false);
      showToast(`${isFooter ? "Footer" : "Header navigation"} published`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not publish changes.",
      );
    } finally {
      setSaving(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if ((loading || authLoading) && !workspace)
    return (
      <main className="sf-navigation-editor sf-navigation-loading">
        <header className="sf-navigation-top">
          <Button unstyled className="sf-back-button" disabled type="button">
            <i className="ph-bold ph-arrow-left" /> Back
          </Button>
          <div className="sf-navigation-title">
            <span>Navigation</span>
            <strong>{isFooter ? "Footer" : "Header"}</strong>
            <small>Loading workspace</small>
          </div>
        </header>
        <div className="sf-route-loading" role="status">
          <span className="sf-route-loading-mark">
            <i className={`ph ${isFooter ? "ph-layout" : "ph-browser"}`} />
          </span>
          <strong>Loading {isFooter ? "footer" : "header navigation"}</strong>
          <small>The builder will be ready in a moment.</small>
        </div>
      </main>
    );
  if (!workspace)
    return (
      <div className="sf-loading">{error || "No website is available."}</div>
    );

  return (
    <main className="sf-navigation-editor">
      <header className="sf-navigation-top">
        <Button unstyled
          className="sf-back-button"
          onClick={() => void navigate({ to: "/" })}
          type="button"
        >
          <i className="ph-bold ph-arrow-left" /> Back
        </Button>
        <div className="sf-navigation-title">
          <span>Navigation</span>
          <strong>{isFooter ? "Footer" : "Header"}</strong>
          <small className="sf-mono">
            {isFooter ? "Site footer" : "Primary menu"} ·{" "}
            {workspace.language.code.toUpperCase()}
          </small>
        </div>
        <span
          className={`sf-editor-status ${published ? "Published" : "Concept"}`}
        >
          {published ? "Published" : "Draft"}
        </span>
        {brokenItems.length ? (
          <span className="sf-navigation-broken">
            <i className="ph-fill ph-warning" /> {brokenItems.length} broken{" "}
            {brokenItems.length === 1 ? "link" : "links"}
          </span>
        ) : null}
        <span className="sf-spacer" />
        <span className="sf-navigation-saved">
          <i
            className={`ph ${saving ? "ph-spinner" : dirty ? "ph-cloud" : "ph-cloud-check"}`}
          />
          {saving
            ? "Saving..."
            : dirty
              ? "Unsaved changes"
              : "All changes saved"}
        </span>
        <Button unstyled
          className="sf-action"
          disabled={!dirty || saving}
          onClick={() => void save()}
          type="button"
        >
          <i className="ph ph-floppy-disk" /> Save draft
        </Button>
        <Button unstyled
          className="sf-action primary"
          disabled={saving}
          onClick={() =>
            brokenItems.length ? setPublishConfirm(true) : void publish()
          }
          type="button"
        >
          <i className="ph-bold ph-rocket-launch" /> Publish changes
        </Button>
      </header>

      <div className="sf-navigation-workspace">
        <section className="sf-navigation-preview">
          <div className="sf-preview-tools">
            <div className="sf-device-toggle">
              {(
                [
                  ["desktop", "ph-monitor", "Desktop"],
                  ["tablet", "ph-device-tablet", "Tablet"],
                  ["mobile", "ph-device-mobile", "Mobile"],
                ] as const
              ).map(([value, icon, label]) => (
                <Button unstyled
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
            <div className="sf-preview-url">
              <i className="ph-fill ph-lock-simple" />
              <span className="sf-mono">{workspace.site.slug}.com</span>
              <b>Preview</b>
            </div>
            <Button unstyled
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
          <div className="sf-navigation-stage sf-scroll">
            <div className={`sf-site-preview ${device}`}>
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

        <aside className="sf-navigation-builder">
          <div className="sf-builder-head">
            <strong>{isFooter ? "Footer content" : "Menu structure"}</strong>
            <span className="sf-mono">{items.length} items</span>
            <span className="sf-spacer" />
            <small>
              <i className="ph ph-arrows-out-cardinal" /> Drag to reorder
            </small>
          </div>
          <div className="sf-builder-scroll sf-scroll">
            {items.length ? (
              <div className="sf-menu-items">
                {items.map((item, index) => (
                  <MenuCard
                    broken={
                      (item.targetType === "page" &&
                        item.kind !== "group" &&
                        !livePaths.has(item.target)) ||
                      item.children.some(
                        (child) =>
                          child.targetType === "page" &&
                          !livePaths.has(child.target),
                      )
                    }
                    drop={dropId === item.id}
                    expanded={expanded.has(item.id)}
                    index={index}
                    item={item}
                    key={item.id}
                    location={location}
                    onAddChild={() => addChild(item.id)}
                    onChildMove={(id, direction) =>
                      moveChild(item.id, id, direction)
                    }
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
                      selected === item.id ||
                      item.children.some((child) => child.id === selected)
                    }
                    total={items.length}
                  />
                ))}
              </div>
            ) : (
              <div className="sf-builder-empty">
                <span>
                  <i
                    className={`ph ${isFooter ? "ph-columns" : "ph-list-plus"}`}
                  />
                </span>
                <strong>
                  {isFooter
                    ? "Build your site footer"
                    : "Build your primary menu"}
                </strong>
                <p>
                  Add links, groups, and a call-to-action. You can reorder
                  everything later.
                </p>
              </div>
            )}
            <div className="sf-add-navigation">
              <Button unstyled
                onClick={() => setAddOpen((value) => !value)}
                type="button"
              >
                <i className="ph-bold ph-plus" />{" "}
                {isFooter ? "Add to footer" : "Add menu item"}
              </Button>
              {addOpen ? (
                <div className="sf-add-navigation-menu">
                  {(
                    (isFooter
                      ? [
                          [
                            "group",
                            false,
                            "Link column",
                            "A titled column of links",
                            "ph-columns",
                          ],
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
                        ]) as Array<
                      [NavigationKind, boolean, string, string, string]
                    >
                  ).map(([kind, external, label, description, icon]) => (
                    <Button unstyled
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
            {error ? <p className="sf-navigation-error">{error}</p> : null}
          </div>
        </aside>
      </div>

      <Modal
        open={publishConfirm}
        onOpenChange={setPublishConfirm}
        className="sf-small-modal"
      >
        <div className="sf-modal-head">
          <span className="sf-modal-icon danger">
            <i className="ph-fill ph-warning" />
          </span>
          <div>
            <ModalTitle>Publish with broken links?</ModalTitle>
            <ModalDescription>
              {brokenItems.length}{" "}
              {brokenItems.length === 1 ? "link points" : "links point"} to
              pages that do not exist.
            </ModalDescription>
          </div>
        </div>
        <div className="sf-publish-warning-list">
          {brokenItems.map((item) => (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <span className="sf-mono">{item.target}</span>
            </div>
          ))}
        </div>
        <div className="sf-modal-actions">
          <ModalClose className="sf-action">Keep editing</ModalClose>
          <Button unstyled
            className="sf-action primary"
            disabled={saving}
            onClick={() => void publish()}
            type="button"
          >
            Publish anyway
          </Button>
        </div>
      </Modal>

      {toast ? (
        <div className="sf-global-toast" role="status">
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
  pageOptions: Array<{ id: string; title: string; path: string }>;
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
      className={`sf-menu-card${selected ? " selected" : ""}${drop ? " drop" : ""}`}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <div className="sf-menu-card-head" onClick={onSelect}>
        <i className="ph ph-dots-six-vertical sf-drag-handle" />
        <span
          className="sf-menu-kind"
          style={{ background: theme.bg, color: theme.fg }}
        >
          <i className={`ph ${theme.icon}`} />
        </span>
        <span className="sf-menu-card-copy">
          <strong>{item.label || "Untitled item"}</strong>
          <small className="sf-mono">
            {item.kind === "group"
              ? `${location === "footer" ? "Column" : "Dropdown"} · ${item.children.length} ${item.children.length === 1 ? "link" : "links"}`
              : `${item.kind === "button" ? "Button · " : ""}${item.target}`}
          </small>
        </span>
        {broken ? (
          <i
            className="ph-fill ph-warning sf-menu-warning"
            title="One or more target pages do not exist"
          />
        ) : null}
        <Button unstyled
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
        <Button unstyled
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
        <Button unstyled
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          title={expanded ? "Collapse" : "Expand"}
          type="button"
        >
          <i className={`ph ph-caret-down${expanded ? " open" : ""}`} />
        </Button>
      </div>
      {expanded ? (
        <div className="sf-menu-card-fields">
          <label className="sf-builder-field">
            <span>Label</span>
            <Input unstyled
              value={item.label}
              onChange={(event) =>
                onUpdate(item.id, { label: event.target.value })
              }
            />
          </label>
          {item.kind === "group" ? (
            <div className="sf-child-links">
              <span>
                {location === "footer"
                  ? "Links in this column"
                  : "Links in this dropdown"}
              </span>
              {item.children.map((child, childIndex) => (
                <div className="sf-child-link" key={child.id}>
                  <span className="sf-menu-kind">
                    <i className="ph ph-link-simple" />
                  </span>
                  <div>
                    <Input unstyled
                      aria-label="Link label"
                      value={child.label}
                      onChange={(event) =>
                        onUpdate(child.id, { label: event.target.value })
                      }
                    />
                    <NativeSelect unstyled
                      aria-label="Link target"
                      value={child.target}
                      onChange={(event) =>
                        onUpdate(child.id, {
                          target: event.target.value,
                          targetType: "page",
                        })
                      }
                    >
                      {!pageOptions.some(
                        (page) => page.path === child.target,
                      ) ? (
                        <option value={child.target}>
                          {child.target} (missing)
                        </option>
                      ) : null}
                      {pageOptions.map((page) => (
                        <option key={page.id} value={page.path}>
                          {page.title} · {page.path}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button unstyled
                    disabled={childIndex === 0}
                    onClick={() => onChildMove(child.id, -1)}
                    title="Move up"
                    type="button"
                  >
                    <i className="ph-bold ph-arrow-up" />
                  </Button>
                  <Button unstyled
                    disabled={childIndex === item.children.length - 1}
                    onClick={() => onChildMove(child.id, 1)}
                    title="Move down"
                    type="button"
                  >
                    <i className="ph-bold ph-arrow-down" />
                  </Button>
                  <Button unstyled
                    onClick={() => onRemove(child.id)}
                    title="Remove link"
                    type="button"
                  >
                    <i className="ph ph-x" />
                  </Button>
                </div>
              ))}
              <Button unstyled
                className="sf-add-child"
                onClick={onAddChild}
                type="button"
              >
                <i className="ph-bold ph-plus" /> Add link to{" "}
                {location === "footer" ? "column" : "dropdown"}
              </Button>
            </div>
          ) : (
            <>
              <div className="sf-link-type">
                <span>Links to</span>
                <div>
                  <Button unstyled
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
                  <Button unstyled
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
              <label className="sf-builder-field">
                <span>{item.targetType === "page" ? "Page" : "URL"}</span>
                {item.targetType === "page" ? (
                  <NativeSelect unstyled
                    value={item.target}
                    onChange={(event) =>
                      onUpdate(item.id, { target: event.target.value })
                    }
                  >
                    {!pageOptions.some((page) => page.path === item.target) ? (
                      <option value={item.target}>
                        {item.target} (missing)
                      </option>
                    ) : null}
                    {pageOptions.map((page) => (
                      <option key={page.id} value={page.path}>
                        {page.title} · {page.path}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input unstyled
                    className="sf-mono"
                    value={item.target}
                    onChange={(event) =>
                      onUpdate(item.id, { target: event.target.value })
                    }
                  />
                )}
              </label>
              <label className="sf-new-tab">
                <Input unstyled
                  checked={item.newTab}
                  onChange={(event) =>
                    onUpdate(item.id, { newTab: event.target.checked })
                  }
                  type="checkbox"
                />{" "}
                Open in a new tab
              </label>
            </>
          )}
          <div className="sf-card-bottom">
            {item.kind === "button" ? (
              <span>
                <i className="ph-fill ph-cursor-click" /> Shown as a button
              </span>
            ) : null}
            <span className="sf-spacer" />
            <Button unstyled
              className="sf-remove-item"
              onClick={() => onRemove(item.id)}
              type="button"
            >
              <i className="ph ph-trash" /> Remove{" "}
              {location === "footer" ? "item" : "menu item"}
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
      <div className="sf-mobile-header-preview">
        <div className="sf-preview-brand">
          <Logo /> <strong>Acme</strong>
          <span className="sf-spacer" />
          <Button unstyled onClick={onMobileToggle} type="button">
            <i className={`ph-bold ${mobileOpen ? "ph-x" : "ph-list"}`} />
          </Button>
        </div>
        {mobileOpen ? (
          <nav>
            {items.map((item) =>
              item.kind === "group" ? (
                <div key={item.id}>
                  <Button unstyled
                    className={selected === item.id ? "selected" : ""}
                    onClick={() => {
                      onSelect(item.id);
                      onGroupToggle(item.id);
                    }}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <i
                      className={`ph-bold ph-caret-down${mobileGroups.has(item.id) ? " open" : ""}`}
                    />
                  </Button>
                  {mobileGroups.has(item.id)
                    ? item.children.map((child) => (
                        <Button unstyled
                          className={`child${selected === child.id ? " selected" : ""}`}
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
                <Button unstyled
                  className={`${item.kind === "button" ? "cta" : ""}${selected === item.id ? " selected" : ""}`}
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
    <div className="sf-desktop-header-preview">
      <header>
        <div className="sf-preview-brand">
          <Logo />
          <strong>Acme</strong>
        </div>
        <nav className="sf-scroll">
          {items.map((item) => (
            <Button unstyled
              className={`${item.kind === "button" ? "cta" : ""}${selected === item.id ? " selected" : ""}`}
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                if (item.kind === "group")
                  onPreviewGroup(previewGroup === item.id ? null : item.id);
              }}
              type="button"
            >
              {item.label}
              {item.kind === "group" ? (
                <i className="ph-bold ph-caret-down" />
              ) : null}
            </Button>
          ))}
        </nav>
      </header>
      {previewGroup ? (
        <div className="sf-preview-dropdown">
          {items
            .find((item) => item.id === previewGroup)
            ?.children.map((child) => (
              <Button unstyled
                className={selected === child.id ? "selected" : ""}
                key={child.id}
                onClick={() => onSelect(child.id)}
                type="button"
              >
                {child.label}
                <span className="sf-mono">{child.target}</span>
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
    <div className={`sf-footer-preview ${device}`}>
      <PreviewSkeleton />
      <footer>
        <div className="sf-footer-main">
          <div className="sf-footer-brand">
            <div className="sf-preview-brand">
              <Logo />
              <strong>Acme</strong>
            </div>
            <p>
              The website-native, open-source CMS for teams who care about their
              URLs.
            </p>
            <div className="sf-socials">
              <i className="ph ph-x-logo" />
              <i className="ph ph-github-logo" />
              <i className="ph ph-linkedin-logo" />
            </div>
            {buttons.map((item) => (
              <Button unstyled
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
              className={`sf-footer-column${selected === group.id ? " selected" : ""}`}
              key={group.id}
              onClick={() => onSelect(group.id)}
            >
              <strong>{group.label}</strong>
              {group.children.map((child) => (
                <Button unstyled
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
        <div className="sf-footer-bottom">
          <span>© 2026 Acme Marketing. All rights reserved.</span>
          <nav>
            {links.map((item) => (
              <Button unstyled
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
    <span className="sf-preview-logo">
      <i className="ph-bold ph-hammer" />
    </span>
  );
}

function PreviewSkeleton() {
  return (
    <div className="sf-preview-skeleton">
      <span />
      <span />
      <span />
    </div>
  );
}
