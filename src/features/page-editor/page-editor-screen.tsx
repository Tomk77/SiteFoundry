import { LoadingSplash, RouteLoading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  deleteEditablePage,
  loadEditablePage,
  type BlockType,
  type ContentBlock,
  type EditablePage,
} from "@/lib/page-editor";
import type { PageTemplateDefinition } from "@/lib/page-templates";
import { loadPageTemplates } from "@/lib/page-templates-data";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorPanel } from "./components/editor-panel";
import { EditorOverlays } from "./components/editor-overlays";
import { EditorToolbar } from "./components/editor-toolbar";
import { PreviewPane } from "./components/preview-pane";
import { VersionContextBar } from "./components/version-context-bar";
import { blockDefinitions, defaults, nextBlockId, type Device, type Tab } from "./editor-model";
import { previewDocument } from "./preview-document";
import { usePageVersions } from "./use-page-versions";

const editorPageCache = new Map<string, EditablePage>();

interface PageEditorScreenProps {
  pageId?: string;
}

export function PageEditorScreen({ pageId }: PageEditorScreenProps) {
  const navigate = useNavigate({ from: "/editor" });
  const { user, loading: authLoading } = useAuth();

  const [page, setPage] = useState<EditablePage | null>(() =>
    pageId ? (editorPageCache.get(pageId) ?? null) : null,
  );
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("content");
  const [device, setDevice] = useState<Device>("desktop");
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addMenu, setAddMenu] = useState(false);
  const [savingAction, setSavingAction] = useState<"concept" | "publish" | "delete" | null>(null);
  const [savedLabel, setSavedLabel] = useState("All changes saved");
  const [refreshing, setRefreshing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [toast, setToast] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<PageTemplateDefinition[]>([]);

  const toastTimer = useRef<number | undefined>(undefined);
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const pendingPreviewScroll = useRef<number | null>(null);

  const saving = savingAction !== null;
  const { changeCount, discardConcept, displayedPage, save, setView, viewingPublished } =
    usePageVersions({
      page,
      saving,
      setPage,
      setSavedLabel,
      setSavingAction,
      showToast,
    });

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoadError("");
    void loadEditablePage(pageId)
      .then((value) => {
        if (!value) {
          setLoadError("The page was not found.");

          return;
        }

        if (value && pageId) editorPageCache.set(pageId, value);
        setPage(value);
        if (value?.blocks[0]) {
          setSelected(value.blocks[0].id);
          setExpanded({ [value.blocks[0].id]: true });
        }
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : "Unable to load this page."),
      );
  }, [pageId, user]);

  useEffect(() => {
    if (page && pageId) editorPageCache.set(pageId, page);
  }, [page, pageId]);

  useEffect(() => {
    if (!page?.siteLanguageId) return;
    void loadPageTemplates(page.siteLanguageId)
      .then(setAvailableTemplates)
      .catch(() => setAvailableTemplates([]));
  }, [page?.siteLanguageId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const rawMessage: unknown = event.data;
      if (!rawMessage || typeof rawMessage !== "object") return;
      const message = rawMessage as Record<string, unknown>;
      if (
        !viewingPublished &&
        message.source === "sc-preview" &&
        (message.type === "select" || message.type === "select-field")
      ) {
        const id = typeof message.id === "string" ? message.id : "";
        if (!id) return;
        setSelected(id);
        setExpanded((value) => ({ ...value, [id]: true }));
        setTab("content");
        if (message.type === "select-field") {
          const fieldKey = typeof message.fieldKey === "string" ? message.fieldKey : "";
          window.setTimeout(() => {
            const field = document.querySelector<HTMLElement>(
              `[data-editor-block="${CSS.escape(id)}"][data-editor-field="${CSS.escape(fieldKey)}"]`,
            );
            field?.scrollIntoView({ behavior: "smooth", block: "center" });
            field?.focus({ preventScroll: true });
          }, 80);
        }
      }

      if (message.source === "sc-preview" && message.type === "ready" && selected) {
        previewRef.current?.contentWindow?.postMessage(
          { source: "sc-editor", type: "select", id: selected, scroll: false },
          "*",
        );
        if (pendingPreviewScroll.current !== null) {
          previewRef.current?.contentWindow?.postMessage(
            {
              source: "sc-editor",
              type: "restore-scroll",
              top: pendingPreviewScroll.current,
            },
            "*",
          );
          pendingPreviewScroll.current = null;
        }
      }
    };

    window.addEventListener("message", onMessage);

    return () => window.removeEventListener("message", onMessage);
  }, [selected, viewingPublished]);

  const selectBlock = (id: string, scroll = true) => {
    setSelected(id);
    const notifyPreview = () =>
      previewRef.current?.contentWindow?.postMessage(
        { source: "sc-editor", type: "select", id, scroll },
        "*",
      );
    notifyPreview();
    window.setTimeout(notifyPreview, 150);
  };

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }

  const problems = useMemo(
    () =>
      displayedPage
        ? [
            ...(!displayedPage.seoDescription.trim() ? ["Meta description is empty."] : []),
            ...displayedPage.blocks
              .filter((block) => block.type === "image" && !block.data.alt?.trim())
              .map(() => "An image block is missing alt text."),
          ]
        : [],
    [displayedPage],
  );

  const path = displayedPage
    ? `${displayedPage.parentPath}${displayedPage.slug}`.replace(/\/{2,}/g, "/")
    : "/";

  const update = (changes: Partial<EditablePage>) => {
    if (viewingPublished) return;
    setPage((value) => (value ? { ...value, ...changes } : value));
    setSavedLabel("Unsaved changes");
  };

  const editBlock = (id: string, key: string, value: string) =>
    page &&
    (() => {
      try {
        pendingPreviewScroll.current = previewRef.current?.contentWindow?.scrollY ?? null;
      } catch {
        pendingPreviewScroll.current = null;
      }

      update({
        blocks: page.blocks.map((block) =>
          block.id === id ? { ...block, data: { ...block.data, [key]: value } } : block,
        ),
      });
    })();

  const moveBlock = (id: string, direction: number) => {
    if (!page) return;
    const blocks = [...page.blocks];
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const currentBlock = blocks[index];
    const targetBlock = blocks[target];
    if (!currentBlock || !targetBlock) return;
    blocks[index] = targetBlock;
    blocks[target] = currentBlock;
    update({ blocks });
  };

  const removeBlock = (id: string) => {
    if (!page) return;
    const block = page.blocks.find((item) => item.id === id);
    update({ blocks: page.blocks.filter((item) => item.id !== id) });
    if (selected === id) setSelected(null);
    showToast(`Removed ${block ? blockDefinitions[block.type].label : "content"} block`);
  };

  const addBlock = (type: BlockType) => {
    if (!page) return;
    const block: ContentBlock = {
      id: nextBlockId(page.blocks),
      type,
      data: defaults[type],
    };
    update({ blocks: [...page.blocks, block] });
    selectBlock(block.id);
    setExpanded((value) => ({ ...value, [block.id]: true }));
    setAddMenu(false);
  };

  const deletePage = async () => {
    if (saving || !page) return;
    setSavingAction("delete");
    try {
      await deleteEditablePage(page.id);
      setDeleteOpen(false);
      await navigate({ to: "/" });
    } catch (error) {
      setDeleteOpen(false);
      showToast(error instanceof Error ? error.message : "Unable to delete this page");
      setSavingAction(null);
    }
  };

  if (authLoading || !user) return <LoadingSplash />;

  if (!page && !loadError)
    return (
      <RouteLoading
        detail="Preparing content blocks and the live preview."
        title="Loading your page editor"
      />
    );

  if (loadError || !page)
    return (
      <div className="sc-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
        <div className="sc-editor-load-error [display:flex] [flex-direction:column] [align-items:center] [gap:8px] [&>i]:[font-size:28px] [&>span]:[margin-bottom:8px]">
          <i className="ph ph-warning-circle" />
          <strong>Couldn’t open this page</strong>
          <span>{loadError || "The page was not found."}</span>
          <Button
            unstyled
            className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
            onClick={() => void navigate({ to: "/" })}
          >
            Back to pages
          </Button>
        </div>
      </div>
    );

  const activePage = displayedPage ?? page;
  const srcDoc = previewDocument(activePage.blocks);
  const deviceWidth = { desktop: "100%", tablet: "820px", mobile: "390px" }[device];

  return (
    <main className="sc-editor [display:flex] [height:100vh] [width:100vw] [animation:sc-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-canvas text-ink motion-reduce:[animation:none] dark:[color:#e9ecf1] dark:[background:#15181c] [&_button]:[font-family:inherit]">
      <EditorToolbar
        page={activePage}
        path={path}
        problems={problems}
        savedLabel={savedLabel}
        saving={saving}
        savingAction={savingAction}
        changeCount={changeCount}
        viewingPublished={viewingPublished}
        onBack={() => void navigate({ to: "/" })}
        onSave={(publish) => void save(publish)}
        onSelectTab={setTab}
        onViewChange={setView}
      />
      <VersionContextBar
        changeCount={page.publishedRevision ? changeCount : 0}
        viewingPublished={viewingPublished}
        onDiscard={() => void discardConcept()}
        onViewConcept={() => setView("concept")}
        onViewPublished={() => setView("published")}
      />
      <div className="sc-editor-workspace [display:flex] [min-height:0] [flex:1] max-[760px]:[position:relative]">
        <PreviewPane
          device={device}
          deviceWidth={deviceWidth}
          path={path}
          previewKey={previewKey}
          previewRef={previewRef}
          refreshing={refreshing}
          srcDoc={srcDoc}
          onDeviceChange={setDevice}
          onOpenPreview={() => showToast("Public preview will open when the frontend is connected")}
          onRefresh={() => {
            setRefreshing(true);
            setPreviewKey((value) => value + 1);
            window.setTimeout(() => setRefreshing(false), 500);
          }}
        />
        <EditorPanel
          addMenu={addMenu}
          availableTemplates={availableTemplates}
          expanded={expanded}
          page={activePage}
          path={path}
          problems={problems}
          readOnly={viewingPublished}
          selected={selected}
          tab={tab}
          onAddBlock={addBlock}
          onChange={update}
          onDeleteRequest={() => setDeleteOpen(true)}
          onEditBlock={editBlock}
          onMoveBlock={moveBlock}
          onRemoveBlock={removeBlock}
          onSelectBlock={selectBlock}
          onSelectTab={setTab}
          onShowToast={showToast}
          onToggleAddMenu={() => setAddMenu((value) => !value)}
          onToggleExpanded={(id) => setExpanded((value) => ({ ...value, [id]: !value[id] }))}
        />
      </div>
      <EditorOverlays
        deleteOpen={deleteOpen}
        saving={saving}
        savingAction={savingAction}
        toast={toast}
        onCloseDelete={() => setDeleteOpen(false)}
        onDelete={() => void deletePage()}
      />
    </main>
  );
}
