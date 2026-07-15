import { Button } from "../components/ui/button";
import { LoadingSplash, RouteLoading } from "../components/loading";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { NativeSelect } from "../components/ui/native-select";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { validatePageTemplate, type PageTemplateDefinition } from "../lib/page-templates";
import { loadPageTemplates } from "../lib/page-templates-data";
import {
  deleteEditablePage,
  loadEditablePage,
  saveEditablePage,
  type BlockType,
  type ContentBlock,
  type EditablePage,
} from "../lib/page-editor";
import "../editor.css";

export const Route = createFileRoute("/editor")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" ? search.page : undefined,
  }),
  component: Editor,
});

const editorPageCache = new Map<string, EditablePage>();

type Tab = "content" | "seo" | "settings";
type Device = "desktop" | "tablet" | "mobile";
interface FieldDefinition {
  key: string;
  label: string;
  type: "text" | "area";
  placeholder: string;
}
const blockDefinitions: Record<
  BlockType,
  {
    label: string;
    icon: string;
    description: string;
    fields: FieldDefinition[];
  }
> = {
  hero: {
    label: "Hero",
    icon: "ph-identification-card",
    description: "Eyebrow, headline & lead",
    fields: [
      {
        key: "eyebrow",
        label: "Eyebrow",
        type: "text",
        placeholder: "Product news",
      },
      {
        key: "headline",
        label: "Headline",
        type: "text",
        placeholder: "Headline",
      },
      {
        key: "subheadline",
        label: "Subheadline",
        type: "area",
        placeholder: "Supporting sentence",
      },
    ],
  },
  richtext: {
    label: "Rich text",
    icon: "ph-text-align-left",
    description: "Body copy paragraphs",
    fields: [
      {
        key: "body",
        label: "Body",
        type: "area",
        placeholder: "Write the body…",
      },
    ],
  },
  quote: {
    label: "Pull quote",
    icon: "ph-quotes",
    description: "Highlighted quotation",
    fields: [
      {
        key: "text",
        label: "Quote",
        type: "area",
        placeholder: "A memorable line",
      },
      {
        key: "cite",
        label: "Attribution",
        type: "text",
        placeholder: "– Name, role",
      },
    ],
  },
  image: {
    label: "Image",
    icon: "ph-image",
    description: "Figure with caption",
    fields: [
      {
        key: "alt",
        label: "Alt text",
        type: "text",
        placeholder: "Describe the image",
      },
      {
        key: "caption",
        label: "Caption",
        type: "text",
        placeholder: "Optional caption",
      },
    ],
  },
  cta: {
    label: "Call to action",
    icon: "ph-cursor-click",
    description: "Heading with button",
    fields: [
      {
        key: "heading",
        label: "Heading",
        type: "text",
        placeholder: "Ready to start?",
      },
      {
        key: "button",
        label: "Button label",
        type: "text",
        placeholder: "Get started",
      },
    ],
  },
};
const defaults: Record<BlockType, Record<string, string>> = {
  hero: { headline: "New headline" },
  richtext: { body: "" },
  quote: { text: "", cite: "" },
  image: { alt: "", caption: "" },
  cta: { heading: "Ready to start?", button: "Get started" },
};

function nextBlockId(blocks: ContentBlock[]) {
  let suffix = blocks.length + 1;
  while (blocks.some((block) => block.id === `block-${suffix}`)) suffix += 1;
  return `block-${suffix}`;
}

const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/* eslint-disable no-useless-escape -- The escaped closing script tag is intentional inside srcDoc. */
function previewDocument(blocks: ContentBlock[]) {
  const content =
    blocks
      .map((block) => {
        const data = block.data,
          cls = "blk";
        let inner = "";
        if (block.type === "hero")
          inner = `${data.eyebrow ? `<p class="eyebrow" data-field-key="eyebrow">${esc(data.eyebrow)}</p>` : ""}<h1 data-field-key="headline">${esc(data.headline || "Untitled")}</h1>${data.subheadline ? `<p class="sub" data-field-key="subheadline">${esc(data.subheadline)}</p>` : ""}<div class="ph">HERO IMAGE 16:9</div>`;
        if (block.type === "richtext")
          inner =
            (data.body || "")
              .split(/\n\n+/)
              .filter(Boolean)
              .map((paragraph) => `<p class="body">${esc(paragraph).replaceAll("\n", "<br>")}</p>`)
              .join("") || '<p class="body empty-text">Empty text block</p>';
        inner = `<div data-field-key="body">${inner}</div>`;
        if (block.type === "quote")
          inner = `<blockquote><span data-field-key="text">“${esc(data.text || "Quote")}”</span><cite data-field-key="cite">${esc(data.cite || "")}</cite></blockquote>`;
        if (block.type === "image")
          inner = `<div class="ph" data-field-key="alt">${esc(data.alt || "IMAGE")}</div>${data.caption ? `<p class="cap" data-field-key="caption">${esc(data.caption)}</p>` : ""}`;
        if (block.type === "cta")
          inner = `<div class="cta"><h3 data-field-key="heading">${esc(data.heading || "Ready?")}</h3><span class="btn" data-field-key="button">${esc(data.button || "Get started")}</span></div>`;
        return `<section class="${cls}" data-id="${block.id}">${inner}</section>`;
      })
      .join("") || '<div class="empty">No content blocks yet · add one from the panel.</div>';
  const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Geist:wght@400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Geist,system-ui,sans-serif;color:#1a1a1a;background:#fff;-webkit-font-smoothing:antialiased}article{max-width:680px;margin:0 auto;padding:56px 28px 96px}.meta{display:flex;align-items:center;gap:12px;font-size:13px;color:#8a8a8a;margin-bottom:28px;flex-wrap:wrap}.cat{color:#2f5fe0;font-weight:600;text-transform:uppercase;letter-spacing:.06em;font-size:11px}.blk{position:relative;outline:2px solid transparent;outline-offset:6px;border-radius:2px;cursor:pointer}.blk.sel{outline-color:#8a95a1}.blk+.blk{margin-top:30px}.eyebrow{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#2f5fe0;margin:0 0 12px}h1{font-family:Newsreader,Georgia,serif;font-weight:600;font-size:42px;line-height:1.12;letter-spacing:-.01em;margin:0 0 16px}.sub{font-size:19px;line-height:1.5;color:#525252;margin:0 0 24px}.ph{border-radius:10px;background:repeating-linear-gradient(135deg,#f1f2f4,#f1f2f4 11px,#e9ebee 11px,#e9ebee 22px);aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;color:#9aa0aa;font-size:12px;font-weight:600;letter-spacing:.03em}.body{font-family:Newsreader,Georgia,serif;font-size:18px;line-height:1.7;color:#2a2a2a;margin:0 0 18px}.empty-text{color:#b8b8b8}blockquote{margin:0;padding:6px 0 6px 22px;border-left:3px solid #2f5fe0;font-family:Newsreader,Georgia,serif;font-size:24px;line-height:1.4;font-weight:500}blockquote cite{display:block;margin-top:12px;font-family:Geist,sans-serif;font-size:13px;font-style:normal;font-weight:600;color:#8a8a8a}.cap{font-size:13px;color:#8a8a8a;margin:10px 2px 0}.cta{background:#0f1115;border-radius:14px;padding:32px;text-align:center;color:#fff}.cta h3{font-family:Newsreader,serif;font-size:26px;margin:0 0 16px}.btn{display:inline-block;background:#2f5fe0;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600}.empty{color:#b0b0b0;text-align:center;padding:80px 0;font-size:14px}</style></head><body><article><div class="meta"><span class="cat">Product</span><span>July 12, 2026</span><span>By Mara Jensen</span></div>${content}</article><script>function selectBlock(id,scroll){document.querySelectorAll('[data-id]').forEach(function(el){el.classList.toggle('sel',el.dataset.id===id)});var target=document.querySelector('[data-id="'+CSS.escape(id)+'"]');if(target&&scroll)target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}document.querySelectorAll('[data-id]').forEach(function(el){el.addEventListener('click',function(){selectBlock(el.dataset.id,false);parent.postMessage({source:'sf-preview',type:'select',id:el.dataset.id},'*')})});window.addEventListener('message',function(event){if(event.data&&event.data.source==='sf-editor'&&event.data.type==='select')selectBlock(event.data.id,event.data.scroll)});parent.postMessage({source:'sf-preview',type:'ready'},'*')<\/script></body></html>`;
  return documentHtml
    .replace(
      "document.querySelectorAll('[data-id]').forEach(function(el){el.addEventListener('click',function(){selectBlock(el.dataset.id,false);parent.postMessage({source:'sf-preview',type:'select',id:el.dataset.id},'*')})});",
      "document.addEventListener('click',function(event){var block=event.target.closest('[data-id]');if(!block)return;var field=event.target.closest('[data-field-key]');selectBlock(block.dataset.id,false);parent.postMessage({source:'sf-preview',type:field?'select-field':'select',id:block.dataset.id,fieldKey:field?field.dataset.fieldKey:null},'*')});",
    )
    .replace(
      "if(event.data&&event.data.source==='sf-editor'&&event.data.type==='select')selectBlock(event.data.id,event.data.scroll)",
      "if(event.data&&event.data.source==='sf-editor'){if(event.data.type==='select')selectBlock(event.data.id,event.data.scroll);if(event.data.type==='restore-scroll')window.scrollTo({top:event.data.top,left:0,behavior:'instant'})}",
    );
}
/* eslint-enable no-useless-escape */

function Editor() {
  const { page: pageId } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState<EditablePage | null>(() =>
      pageId ? (editorPageCache.get(pageId) ?? null) : null,
    ),
    [loadError, setLoadError] = useState(""),
    [tab, setTab] = useState<Tab>("content"),
    [device, setDevice] = useState<Device>("desktop"),
    [selected, setSelected] = useState<string | null>(null),
    [expanded, setExpanded] = useState<Record<string, boolean>>({}),
    [addMenu, setAddMenu] = useState(false),
    [savingAction, setSavingAction] = useState<"concept" | "publish" | "delete" | null>(null),
    [savedLabel, setSavedLabel] = useState("Autosaved just now"),
    [refreshing, setRefreshing] = useState(false),
    [previewKey, setPreviewKey] = useState(0),
    [toast, setToast] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false),
    [availableTemplates, setAvailableTemplates] = useState<PageTemplateDefinition[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);
  const saving = savingAction !== null;
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const pendingPreviewScroll = useRef<number | null>(null);
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
        message.source === "sf-preview" &&
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
      if (message.source === "sf-preview" && message.type === "ready" && selected) {
        previewRef.current?.contentWindow?.postMessage(
          { source: "sf-editor", type: "select", id: selected, scroll: false },
          "*",
        );
        if (pendingPreviewScroll.current !== null) {
          previewRef.current?.contentWindow?.postMessage(
            {
              source: "sf-editor",
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
  }, [selected]);
  const selectBlock = (id: string, scroll = true) => {
    setSelected(id);
    const notifyPreview = () =>
      previewRef.current?.contentWindow?.postMessage(
        { source: "sf-editor", type: "select", id, scroll },
        "*",
      );
    notifyPreview();
    window.setTimeout(notifyPreview, 150);
  };
  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };
  const problems = useMemo(
    () =>
      page
        ? [
            ...(!page.seoDescription.trim() ? ["Meta description is empty."] : []),
            ...page.blocks
              .filter((block) => block.type === "image" && !block.data.alt?.trim())
              .map(() => "An image block is missing alt text."),
          ]
        : [],
    [page],
  );
  const path = page ? `${page.parentPath}${page.slug}`.replace(/\/{2,}/g, "/") : "/";
  const update = (changes: Partial<EditablePage>) => {
    setPage((value) => (value ? { ...value, ...changes } : value));
    setSavedLabel("Unsaved changes");
  };
  const save = async (publish = false) => {
    if (!page || saving) return;
    setSavingAction(publish ? "publish" : "concept");
    setSavedLabel("Saving…");
    try {
      const result = await saveEditablePage(page, publish);
      setPage((value) =>
        value
          ? {
              ...value,
              path,
              updatedAt: result.updatedAt,
              status: result.status,
              validationStatus: result.validationStatus,
            }
          : value,
      );
      setSavedLabel("Autosaved just now");
      showToast(
        publish
          ? page.status === "published"
            ? "Re-published"
            : "Page published · now live"
          : "Concept saved",
      );
    } catch (error) {
      setSavedLabel("Save failed");
      showToast(error instanceof Error ? error.message : "Unable to save this page");
    } finally {
      setSavingAction(null);
    }
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
    const blocks = [...page.blocks],
      index = blocks.findIndex((block) => block.id === id),
      target = index + direction;
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
      <div className="sf-loading">
        <div className="sf-editor-load-error">
          <i className="ph ph-warning-circle" />
          <strong>Couldn’t open this page</strong>
          <span>{loadError || "The page was not found."}</span>
          <Button unstyled className="sf-action" onClick={() => void navigate({ to: "/" })}>
            Back to pages
          </Button>
        </div>
      </div>
    );
  const srcDoc = previewDocument(page.blocks),
    deviceWidth = { desktop: "100%", tablet: "820px", mobile: "390px" }[device];
  return (
    <main className="sf-editor">
      <header className="sf-editor-top">
        <Button unstyled className="sf-editor-tree" onClick={() => void navigate({ to: "/" })}>
          <i className="ph-bold ph-arrow-left" />
          Tree
        </Button>
        <div className="sf-editor-location">
          <div>
            {page.breadcrumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`}>
                {index > 0 && <i className="ph ph-caret-right" />}
                <span className={index === page.breadcrumbs.length - 1 ? "current" : ""}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          <b>{path}</b>
        </div>
        <span className={`sf-editor-status ${page.status}`}>
          <i />
          {page.status === "published" ? "Published" : "Concept"}
        </span>
        {problems.length > 0 && (
          <Button unstyled className="sf-editor-problems" onClick={() => setTab("seo")}>
            <i className="ph-fill ph-warning" />
            {problems.length} {problems.length === 1 ? "problem" : "problems"}
          </Button>
        )}
        <span className="sf-spacer" />
        <span className="sf-editor-saved">
          <i
            className={`ph ${saving ? "ph-spinner" : savedLabel === "Save failed" ? "ph-warning-circle" : "ph-cloud-check"}`}
          />
          {savedLabel}
        </span>
        <Button
          unstyled
          className="sf-action"
          disabled={saving}
          loading={savingAction === "concept"}
          onClick={() => void save(false)}
        >
          <i className="ph ph-floppy-disk" />
          Save concept
        </Button>
        <Button
          unstyled
          className="sf-action primary"
          disabled={saving}
          loading={savingAction === "publish"}
          onClick={() => void save(true)}
        >
          <i className="ph-bold ph-rocket-launch" />
          {page.status === "published" ? "Publish changes" : "Publish"}
        </Button>
      </header>
      <div className="sf-editor-workspace">
        <section className="sf-preview-pane">
          <div className="sf-preview-tools">
            <div className="sf-device-toggle">
              {(
                [
                  ["desktop", "ph-monitor", "Desktop"],
                  ["tablet", "ph-device-tablet", "Tablet"],
                  ["mobile", "ph-device-mobile", "Mobile"],
                ] as const
              ).map(([id, icon, label]) => (
                <Button
                  unstyled
                  className={device === id ? "active" : ""}
                  title={label}
                  onClick={() => setDevice(id)}
                  key={id}
                >
                  <i className={`ph-bold ${icon}`} />
                </Button>
              ))}
            </div>
            <div className="sf-preview-url">
              <i className="ph-fill ph-lock-simple" />
              <span>acme.com{path}</span>
              <b>Preview</b>
            </div>
            <Button
              unstyled
              className={refreshing ? "spin" : ""}
              title="Refresh preview"
              onClick={() => {
                setRefreshing(true);
                setPreviewKey((value) => value + 1);
                window.setTimeout(() => setRefreshing(false), 500);
              }}
            >
              <i className="ph ph-arrow-clockwise" />
            </Button>
            <Button
              unstyled
              title="Open preview"
              onClick={() => showToast("Public preview will open when the frontend is connected")}
            >
              <i className="ph ph-arrow-square-out" />
            </Button>
          </div>
          <div className="sf-preview-stage sf-scroll">
            <iframe
              ref={previewRef}
              key={previewKey}
              title="Live page preview"
              srcDoc={srcDoc}
              style={{
                width: deviceWidth,
                borderRadius: device === "desktop" ? 6 : 14,
              }}
            />
          </div>
        </section>
        <aside className="sf-editor-panel">
          <div className="sf-editor-tabs">
            <Button
              unstyled
              className={tab === "content" ? "active" : ""}
              onClick={() => setTab("content")}
            >
              Content
            </Button>
            <Button
              unstyled
              className={tab === "seo" ? "active" : ""}
              onClick={() => setTab("seo")}
            >
              SEO{problems.length > 0 && <b>{problems.length}</b>}
            </Button>
            <Button
              unstyled
              className={tab === "settings" ? "active" : ""}
              onClick={() => setTab("settings")}
            >
              Page information
            </Button>
          </div>
          <div className="sf-editor-fields sf-scroll">
            {tab === "content" && (
              <div className="sf-block-list">
                {page.blocks.map((block, index) => {
                  const definition = blockDefinitions[block.type],
                    open = Boolean(expanded[block.id]),
                    active = selected === block.id;
                  return (
                    <article className={`sf-block ${active ? "selected" : ""}`} key={block.id}>
                      <header
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          selectBlock(block.id);
                          setExpanded((value) => ({
                            ...value,
                            [block.id]: !open,
                          }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          selectBlock(block.id);
                          setExpanded((value) => ({ ...value, [block.id]: !open }));
                        }}
                      >
                        <span className={`sf-block-icon ${block.type}`}>
                          <i className={`ph ${definition.icon}`} />
                        </span>
                        <strong>{definition.label}</strong>
                        <span className="sf-spacer" />
                        <Button
                          unstyled
                          disabled={index === 0}
                          title="Move up"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveBlock(block.id, -1);
                          }}
                        >
                          <i className="ph-bold ph-arrow-up" />
                        </Button>
                        <Button
                          unstyled
                          disabled={index === page.blocks.length - 1}
                          title="Move down"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveBlock(block.id, 1);
                          }}
                        >
                          <i className="ph-bold ph-arrow-down" />
                        </Button>
                        <Button
                          unstyled
                          title="Remove block"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeBlock(block.id);
                          }}
                        >
                          <i className="ph ph-trash" />
                        </Button>
                        <i className={`ph ph-caret-down ${open ? "open" : ""}`} />
                      </header>
                      {open && (
                        <div className="sf-block-fields">
                          {definition.fields.map((field) => (
                            <label className="sf-editor-field" key={field.key}>
                              <span>{field.label}</span>
                              {field.type === "area" ? (
                                <Textarea
                                  unstyled
                                  className="sf-editor-input"
                                  value={block.data[field.key] || ""}
                                  data-editor-block={block.id}
                                  data-editor-field={field.key}
                                  placeholder={field.placeholder}
                                  onFocus={() => {
                                    if (selected !== block.id) selectBlock(block.id);
                                  }}
                                  onChange={(event) =>
                                    editBlock(block.id, field.key, event.target.value)
                                  }
                                />
                              ) : (
                                <Input
                                  unstyled
                                  className="sf-editor-input"
                                  value={block.data[field.key] || ""}
                                  data-editor-block={block.id}
                                  data-editor-field={field.key}
                                  placeholder={field.placeholder}
                                  onFocus={() => {
                                    if (selected !== block.id) selectBlock(block.id);
                                  }}
                                  onChange={(event) =>
                                    editBlock(block.id, field.key, event.target.value)
                                  }
                                />
                              )}
                              {block.type === "image" &&
                                field.key === "alt" &&
                                !block.data.alt?.trim() && (
                                  <em>
                                    <i className="ph-fill ph-warning" />
                                    Alt text is required for accessibility.
                                  </em>
                                )}
                            </label>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                <div className="sf-add-block">
                  <Button unstyled onClick={() => setAddMenu((value) => !value)}>
                    <i className="ph-bold ph-plus" />
                    Add block
                  </Button>
                  {addMenu && (
                    <div className="sf-add-menu">
                      {(Object.keys(blockDefinitions) as BlockType[]).map((type) => (
                        <Button unstyled onClick={() => addBlock(type)} key={type}>
                          <i className={`ph ${blockDefinitions[type].icon}`} />
                          <span>
                            <strong>{blockDefinitions[type].label}</strong>
                            <small>{blockDefinitions[type].description}</small>
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === "seo" && (
              <div className="sf-editor-form">
                {problems.length > 0 && (
                  <div className="sf-seo-problems">
                    <strong>
                      <i className="ph-fill ph-warning" />
                      {problems.length} to resolve before publishing
                    </strong>
                    {problems.map((problem, index) => (
                      <span key={`${problem}-${index}`}>· {problem}</span>
                    ))}
                  </div>
                )}
                <label className="sf-editor-field" htmlFor="seo-title">
                  <span>Meta title</span>
                  <Input
                    unstyled
                    className="sf-editor-input"
                    id="seo-title"
                    value={page.seoTitle}
                    onChange={(event) => update({ seoTitle: event.target.value })}
                  />
                  <small>{page.seoTitle.length}/60</small>
                </label>
                <label className="sf-editor-field" htmlFor="seo-description">
                  <span>Meta description</span>
                  <Textarea
                    unstyled
                    className="sf-editor-input"
                    id="seo-description"
                    value={page.seoDescription}
                    onChange={(event) => update({ seoDescription: event.target.value })}
                    placeholder="Summarize this page for search results"
                  />
                  <small className={page.seoDescription.length > 160 ? "over" : ""}>
                    {page.seoDescription.length}/160
                  </small>
                </label>
                <div className="sf-editor-field">
                  <span>Social share image</span>
                  <div className="sf-social-image">
                    <i className="ph-fill ph-image" />
                    <b>{page.socialImage || "og-default.png"}</b>
                    <Button
                      unstyled
                      onClick={() =>
                        showToast("Media selection will be connected with uploading later")
                      }
                    >
                      Replace
                    </Button>
                  </div>
                </div>
                <div className="sf-editor-field">
                  <span>Canonical URL</span>
                  <div className="sf-canonical">
                    <b>acme.com{path}</b>
                    <i className="ph-fill ph-lock-simple" />
                  </div>
                </div>
              </div>
            )}
            {tab === "settings" && (
              <div className="sf-editor-form settings">
                <label className="sf-editor-field">
                  <span>Slug</span>
                  <div className="sf-slug">
                    <b>{page.parentPath}</b>
                    <Input
                      unstyled
                      value={page.slug}
                      onChange={(event) =>
                        update({
                          slug: event.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
                        })
                      }
                    />
                  </div>
                  {path !== page.path && (
                    <em>
                      <i className="ph-fill ph-warning" />
                      Changing the slug updates this URL and creates a redirect from the old one.
                    </em>
                  )}
                </label>
                <dl className="sf-page-meta">
                  <div>
                    <dt>Parent</dt>
                    <dd>
                      {page.parentTitle || "Root"} ({page.parentPath})
                    </dd>
                  </div>
                  <div>
                    <dt>From template</dt>
                    <dd>{page.templateName}</dd>
                  </div>
                  <div>
                    <dt>Last published</dt>
                    <dd>
                      {page.status === "published"
                        ? new Date(page.updatedAt).toLocaleDateString()
                        : "Not yet published"}
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{new Date(page.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
                <label className="sf-editor-field">
                  <span>Preferred child template</span>
                  <NativeSelect
                    unstyled
                    className="sf-editor-input"
                    value={page.preferredChildTemplate || ""}
                    onChange={(event) =>
                      update({ preferredChildTemplate: event.target.value || null })
                    }
                  >
                    <option value="">
                      Use site fallback
                      {availableTemplates.find((template) => template.fallback)
                        ? ` (${availableTemplates.find((template) => template.fallback)?.name})`
                        : ""}
                    </option>
                    {page.preferredChildTemplate &&
                    !availableTemplates.some(
                      (template) => template.key === page.preferredChildTemplate,
                    ) ? (
                      <option disabled value={page.preferredChildTemplate}>
                        Unavailable template ({page.preferredChildTemplate})
                      </option>
                    ) : null}
                    {availableTemplates.map((template) => (
                      <option
                        disabled={
                          template.status !== "published" ||
                          Boolean(validatePageTemplate(template).length)
                        }
                        key={template.key}
                        value={template.key}
                      >
                        {template.name}
                        {template.status !== "published" || validatePageTemplate(template).length
                          ? " (unavailable)"
                          : ""}
                      </option>
                    ))}
                  </NativeSelect>
                  <p>Suggested first when adding a child page here.</p>
                </label>
                <div className="sf-translations">
                  <span>Translations</span>
                  <div>
                    <b>EN</b>
                    <span>This page (English)</span>
                    <i className="ph-fill ph-link-simple" />
                  </div>
                  <div>
                    <b>NL</b>
                    <span>Productlancering</span>
                    <i className="ph-fill ph-link-simple" />
                  </div>
                  <div>
                    <b>FR</b>
                    <span>Not translated yet</span>
                    <Button
                      unstyled
                      onClick={() => showToast("Translation creation will be connected later")}
                    >
                      Create
                    </Button>
                  </div>
                </div>
                <div className="sf-danger">
                  <span>Danger zone</span>
                  <Button unstyled onClick={() => setDeleteOpen(true)}>
                    <i className="ph ph-trash" />
                    Delete this page
                  </Button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
      {toast && (
        <div className="sf-editor-toast">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
      {deleteOpen && (
        <div
          className="sf-editor-modal"
          onMouseDown={(event) => event.target === event.currentTarget && setDeleteOpen(false)}
          role="presentation"
        >
          <section>
            <i className="ph ph-trash" />
            <h2>Delete this page?</h2>
            <p>This permanently removes the page and its content. This cannot be undone.</p>
            <div>
              <Button unstyled className="sf-action" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                unstyled
                className="sf-action danger"
                disabled={saving}
                loading={savingAction === "delete"}
                onClick={() => void deletePage()}
              >
                Delete page
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
