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
      <div className="sf-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
        <div className="sf-editor-load-error [display:flex] [flex-direction:column] [align-items:center] [gap:8px] [&>i]:[font-size:28px] [&>span]:[margin-bottom:8px]">
          <i className="ph ph-warning-circle" />
          <strong>Couldn’t open this page</strong>
          <span>{loadError || "The page was not found."}</span>
          <Button
            unstyled
            className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
            onClick={() => void navigate({ to: "/" })}
          >
            Back to pages
          </Button>
        </div>
      </div>
    );
  const srcDoc = previewDocument(page.blocks),
    deviceWidth = { desktop: "100%", tablet: "820px", mobile: "390px" }[device];
  return (
    <main className="sf-editor [display:flex] [height:100vh] [width:100vw] [animation:sf-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-canvas text-ink motion-reduce:[animation:none] dark:[color:#e9ecf1] dark:[background:#15181c] [&_button]:[font-family:inherit]">
      <header className="sf-editor-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sf-border)] max-[760px]:[gap:7px] dark:[border-color:#323841] dark:[background:#1d2126] [&_.sf-action]:[height:34px] [&_.sf-action:disabled]:[opacity:0.55] max-[760px]:[&_.sf-action:not(.primary)]:[display:none] max-[760px]:[&_.sf-editor-location]:[display:none] max-[760px]:[&_.sf-editor-status]:[display:none]">
        <Button
          unstyled
          className="sf-editor-tree [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126]"
          onClick={() => void navigate({ to: "/" })}
        >
          <i className="ph-bold ph-arrow-left" />
          Tree
        </Button>
        <div className="sf-editor-location [display:flex] [min-width:0] [flex-direction:column] [gap:1px] [&_.current]:[font-weight:600] [&_.current]:[color:#33474a] dark:[&_.current]:[color:#a7aeb8] [&_i]:[font-size:10px] [&>b]:[white-space:nowrap] [&>b]:text-action [&>b]:[font:500_12px_'Geist_Mono'] dark:[&>b]:[color:#b994f8] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:6px] [&>div]:[font-size:12px] [&>div]:text-ink-subtle max-[1000px]:[&>div]:[display:none] [&>div>span]:[display:flex] [&>div>span]:[align-items:center] [&>div>span]:[gap:6px]">
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
        <span
          className={`sf-editor-status [display:inline-flex] [height:22px] [align-items:center] [gap:5px] [border-radius:5px] [padding:0_8px] [font-size:11.5px] [font-weight:600] [border:0] [&.concept]:bg-concept-soft [&.concept]:text-concept [&.published]:bg-published-soft [&.published]:text-published [&>i]:[height:5px] [&>i]:[width:5px] [&>i]:[border-radius:50%] [&>i]:[background:currentColor] ${page.status}`}
        >
          <i />
          {page.status === "published" ? "Published" : "Concept"}
        </span>
        {problems.length > 0 && (
          <Button
            unstyled
            className="sf-editor-problems [display:inline-flex] [height:22px] [cursor:pointer] [align-items:center] [gap:5px] [border-radius:5px] bg-concept-soft [padding:0_8px] [font-size:11.5px] [font-weight:600] text-concept [border:0] max-[1000px]:[display:none]"
            onClick={() => setTab("seo")}
          >
            <i className="ph-fill ph-warning" />
            {problems.length} {problems.length === 1 ? "problem" : "problems"}
          </Button>
        )}
        <span className="sf-spacer [flex:1]" />
        <span className="sf-editor-saved [display:inline-flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle max-[1000px]:[display:none] [&_.ph-spinner]:[animation:sf-editor-spin_0.8s_linear_infinite] [&_.ph-spinner]:text-ink-subtle [&_i]:[font-size:14px] [&_i]:[color:#1f9d57]">
          <i
            className={`ph ${saving ? "ph-spinner" : savedLabel === "Save failed" ? "ph-warning-circle" : "ph-cloud-check"}`}
          />
          {savedLabel}
        </span>
        <Button
          unstyled
          className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={saving}
          loading={savingAction === "concept"}
          onClick={() => void save(false)}
        >
          <i className="ph ph-floppy-disk" />
          Save concept
        </Button>
        <Button
          unstyled
          className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
          disabled={saving}
          loading={savingAction === "publish"}
          onClick={() => void save(true)}
        >
          <i className="ph-bold ph-rocket-launch" />
          {page.status === "published" ? "Publish changes" : "Publish"}
        </Button>
      </header>
      <div className="sf-editor-workspace [display:flex] [min-height:0] [flex:1] max-[760px]:[position:relative]">
        <section className="sf-preview-pane [display:flex] [min-width:0] [flex:1] [flex-direction:column] bg-sunken dark:[background:#15181c]">
          <div className="sf-preview-tools [display:flex] [height:48px] [flex:none] [align-items:center] [gap:12px] [padding:0_16px] [background:#fafcfa] [border-bottom:1px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[background:#1d2126] [&>button]:[display:grid] [&>button]:[height:32px] [&>button]:[width:32px] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:6px] [&>button]:[font-size:16px] [&>button]:text-ink-muted [&>button]:[background:transparent] [&>button]:[border:0] [&>button.spin_i]:[animation:sf-editor-spin_0.55s_linear_infinite] [&>button:hover]:bg-sunken [&>button:hover]:text-ink dark:[&>button:hover]:[color:#e9ecf1] dark:[&>button:hover]:[background:#242930]">
            <div className="sf-device-toggle [display:flex] [gap:2px] [border-radius:8px] [padding:2px] [background:#eaeeea] dark:[background:#15181c] [&_button]:[display:grid] [&_button]:[height:28px] [&_button]:[width:30px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:6px] [&_button]:[font-size:16px] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.14)] dark:[&_button.active]:[color:#b994f8] dark:[&_button.active]:[box-shadow:none] dark:[&_button.active]:[background:#2c333b]">
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
            <div className="sf-preview-url [display:flex] [height:32px] [max-width:440px] [min-width:0] [flex:1] [align-items:center] [gap:8px] [border-radius:999px] bg-surface [padding:0_12px] [border:1px_solid_var(--sf-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&>b]:[border-radius:999px] [&>b]:bg-concept-soft [&>b]:[padding:1px_6px] [&>b]:[font-size:10px] [&>b]:text-concept [&>i]:[font-size:12px] [&>i]:[color:#1f9d57] [&>span]:[flex:1] [&>span]:[overflow:hidden] [&>span]:[text-overflow:ellipsis] [&>span]:[white-space:nowrap] [&>span]:text-ink-muted [&>span]:[font:12px_'Geist_Mono'] dark:[&>span]:[color:#a7aeb8]">
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
          <div className="sf-preview-stage sf-scroll [display:flex] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [align-items:flex-start] [justify-content:center] [overflow:auto] [padding:24px] dark:[background:#15181c] [&_iframe]:[height:100%] [&_iframe]:[min-height:100%] [&_iframe]:[max-width:100%] [&_iframe]:bg-surface [&_iframe]:[box-shadow:0_8px_30px_rgba(23,_35,_38,_0.12)] [&_iframe]:[border:0] [&_iframe]:[transition:width_0.2s_ease] dark:[&_iframe]:[box-shadow:0_12px_36px_rgb(0_0_0_/_32%)] dark:[&_iframe]:[outline:1px_solid_#323841] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
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
        <aside className="sf-editor-panel [display:flex] [min-height:0] [width:404px] [flex:none] [flex-direction:column] bg-surface [border-left:1px_solid_var(--sf-border)] max-[1000px]:[width:370px] max-[760px]:[position:absolute] max-[760px]:[top:0] max-[760px]:[right:0] max-[760px]:[bottom:0] max-[760px]:[z-index:10] max-[760px]:[width:min(404px,_92vw)] max-[760px]:[box-shadow:-8px_0_26px_rgba(23,_35,_38,_0.15)] dark:[border-color:#323841] dark:[background:#1d2126]">
          <div className="sf-editor-tabs [display:flex] [flex:none] [gap:2px] [padding:8px_12px_0] [border-bottom:1px_solid_var(--sf-sunken)] dark:[border-color:#323841] [&_b]:[display:inline-flex] [&_b]:[height:16px] [&_b]:[min-width:16px] [&_b]:[align-items:center] [&_b]:[justify-content:center] [&_b]:[border-radius:999px] [&_b]:bg-concept-soft [&_b]:[padding:0_4px] [&_b]:[font-size:10px] [&_b]:text-concept [&_button]:[margin-bottom:-1px] [&_button]:[display:inline-flex] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[padding:8px_12px_10px] [&_button]:[font-size:13px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border-bottom:2px_solid_transparent] [&_button]:[border:0] dark:[&_button]:[color:#a7aeb8] [&_button.active]:border-action [&_button.active]:text-action dark:[&_button.active]:[color:#b994f8]">
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
          <div className="sf-editor-fields sf-scroll [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [padding:16px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            {tab === "content" && (
              <div className="sf-block-list [display:flex] [flex-direction:column] [gap:10px]">
                {page.blocks.map((block, index) => {
                  const definition = blockDefinitions[block.type],
                    open = Boolean(expanded[block.id]),
                    active = selected === block.id;
                  return (
                    <article
                      className={`sf-block [overflow:hidden] [border-radius:10px] bg-surface [border:1.5px_solid_var(--sf-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&.selected]:border-selection-border dark:[&.selected]:[border-color:#515a65] [&.selected>header]:bg-selection-surface dark:[&.selected>header]:[background:#2c333b] [&>header]:[display:flex] [&>header]:[cursor:pointer] [&>header]:[align-items:center] [&>header]:[gap:9px] [&>header]:bg-surface [&>header]:[padding:9px_10px] dark:[&>header]:[border-color:#3d444e] dark:[&>header]:[color:#e9ecf1] dark:[&>header]:[background:#1d2126] [&>header_button]:[display:grid] [&>header_button]:[height:24px] [&>header_button]:[width:24px] [&>header_button]:[cursor:pointer] [&>header_button]:[place-items:center] [&>header_button]:[border-radius:6px] [&>header_button]:[font-size:14px] [&>header_button]:text-ink-subtle [&>header_button]:[background:transparent] [&>header_button]:[border:0] [&>header_button:disabled]:[cursor:default] [&>header_button:disabled]:[color:#d3dad5] [&>header_button:hover]:bg-sunken dark:[&>header_button:hover]:[color:#e9ecf1] dark:[&>header_button:hover]:[background:#242930] [&>header_button:nth-last-of-type(1):hover]:bg-danger-soft [&>header_button:nth-last-of-type(1):hover]:text-danger [&>header_strong]:[font-size:13px] [&>header>.ph-caret-down]:[font-size:14px] [&>header>.ph-caret-down]:text-ink-subtle [&>header>.ph-caret-down]:[transition:transform_0.15s] [&>header>.ph-caret-down.open]:[transform:rotate(180deg)] ${active ? "selected" : ""}`}
                      key={block.id}
                    >
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
                        <span
                          className={`sf-block-icon [display:grid] [height:28px] [width:28px] [flex:none] [place-items:center] [border-radius:7px] bg-selection [font-size:15px] text-action [&.cta]:bg-clay-soft [&.cta]:text-clay-dark [&.image]:[color:#3f5c8a] [&.image]:[background:#e7eef5] [&.quote]:[color:#5b4b8a] [&.quote]:[background:#ede7f5] [&.richtext]:bg-sunken [&.richtext]:text-ink-muted ${block.type}`}
                        >
                          <i className={`ph ${definition.icon}`} />
                        </span>
                        <strong>{definition.label}</strong>
                        <span className="sf-spacer [flex:1]" />
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
                        <div className="sf-block-fields [display:flex] [flex-direction:column] [gap:12px] [padding:12px] [border-top:1px_solid_var(--sf-sunken)] dark:[border-color:#323841]">
                          {definition.fields.map((field) => (
                            <label
                              className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
                              key={field.key}
                            >
                              <span>{field.label}</span>
                              {field.type === "area" ? (
                                <Textarea
                                  unstyled
                                  className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
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
                                  className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
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
                <div className="sf-add-block [position:relative] [&>button]:[display:inline-flex] [&>button]:[height:42px] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[justify-content:center] [&>button]:[gap:7px] [&>button]:[border-radius:10px] [&>button]:[font-size:13px] [&>button]:[font-weight:600] [&>button]:text-action [&>button]:[background:#fafcfa] [&>button]:[border:1.5px_dashed_#c2ccc4] dark:[&>button]:[border-color:#323841] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#242930] [&>button:hover]:border-selection-border [&>button:hover]:bg-selection">
                  <Button unstyled onClick={() => setAddMenu((value) => !value)}>
                    <i className="ph-bold ph-plus" />
                    Add block
                  </Button>
                  {addMenu && (
                    <div className="sf-add-menu [position:absolute] [right:0] [bottom:48px] [left:0] [z-index:20] [animation:sf-editor-pop_0.13s_ease] [border-radius:10px] bg-surface [padding:5px] [box-shadow:0_12px_32px_rgba(23,_35,_38,_0.16)] [border:1px_solid_var(--sf-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[font-size:13px] [&>button]:[display:flex] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[gap:10px] [&>button]:[border-radius:7px] [&>button]:bg-surface [&>button]:[padding:8px_9px] [&>button]:[text-align:left] [&>button]:[border:0] dark:[&>button]:[border-color:#3d444e] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#1d2126] [&>button:hover]:bg-canvas dark:[&>button:hover]:[color:#e9ecf1] dark:[&>button:hover]:[background:#242930] [&>button>i]:[display:grid] [&>button>i]:[height:30px] [&>button>i]:[width:30px] [&>button>i]:[flex:none] [&>button>i]:[place-items:center] [&>button>i]:[border-radius:7px] [&>button>i]:bg-sunken [&>button>i]:[font-size:16px] [&>button>i]:text-action [&>button>span]:[display:flex] [&>button>span]:[flex-direction:column]">
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
              <div className="sf-editor-form [display:flex] [flex-direction:column] [gap:16px] [&.settings]:[gap:18px]">
                {problems.length > 0 && (
                  <div className="sf-seo-problems [display:flex] [flex-direction:column] [gap:7px] [border-radius:10px] [padding:12px] [color:#7a5405] [background:#fcf6e8] [border:1px_solid_#ecd9ae] dark:[border-color:#6d5522] dark:[color:#e0b341] dark:[background:#2c281c] [&_span]:[padding-left:22px] [&_span]:[font-size:12px] [&_strong]:[display:flex] [&_strong]:[align-items:center] [&_strong]:[gap:7px] [&_strong]:[font-size:12.5px] [&_strong]:text-concept">
                    <strong>
                      <i className="ph-fill ph-warning" />
                      {problems.length} to resolve before publishing
                    </strong>
                    {problems.map((problem, index) => (
                      <span key={`${problem}-${index}`}>· {problem}</span>
                    ))}
                  </div>
                )}
                <label
                  className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
                  htmlFor="seo-title"
                >
                  <span>Meta title</span>
                  <Input
                    unstyled
                    className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
                    id="seo-title"
                    value={page.seoTitle}
                    onChange={(event) => update({ seoTitle: event.target.value })}
                  />
                  <small>{page.seoTitle.length}/60</small>
                </label>
                <label
                  className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
                  htmlFor="seo-description"
                >
                  <span>Meta description</span>
                  <Textarea
                    unstyled
                    className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
                    id="seo-description"
                    value={page.seoDescription}
                    onChange={(event) => update({ seoDescription: event.target.value })}
                    placeholder="Summarize this page for search results"
                  />
                  <small className={page.seoDescription.length > 160 ? "over" : ""}>
                    {page.seoDescription.length}/160
                  </small>
                </label>
                <div className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
                  <span>Social share image</span>
                  <div className="sf-social-image [display:flex] [align-items:center] [gap:11px] [border-radius:10px] [padding:11px] [background:#fafcfa] [border:1px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[color:#e9ecf1] dark:[background:#242930] [&_button]:[height:30px] [&_button]:[cursor:pointer] [&_button]:[border-radius:7px] [&_button]:bg-surface [&_button]:[padding:0_10px] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:[border:1px_solid_var(--sf-field)] dark:[&_button]:[border-color:#3d444e] dark:[&_button]:[color:#e9ecf1] dark:[&_button]:[background:#1d2126] [&>b]:[flex:1] [&>b]:[overflow:hidden] [&>b]:[text-overflow:ellipsis] [&>b]:text-ink-muted [&>b]:[font:12.5px_'Geist_Mono'] dark:[&>b]:[color:#a7aeb8] [&>i]:[display:grid] [&>i]:[height:36px] [&>i]:[width:56px] [&>i]:[flex:none] [&>i]:[place-items:center] [&>i]:[border-radius:6px] [&>i]:[font-size:18px] [&>i]:[color:#7f8fa9] [&>i]:[background:#e7eef5]">
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
                <div className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
                  <span>Canonical URL</span>
                  <div className="sf-canonical [display:flex] [align-items:center] [gap:8px] [border-radius:8px] [padding:9px_10px] [background:#f0f2f5] [border:1.5px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[color:#e9ecf1] dark:[background:#242930] [&_b]:[flex:1] [&_b]:[overflow:hidden] [&_b]:[text-overflow:ellipsis] [&_b]:[white-space:nowrap] [&_b]:text-ink-muted [&_b]:[font:12.5px_'Geist_Mono'] dark:[&_b]:[color:#a7aeb8] [&_i]:[color:#aebab6]">
                    <b>acme.com{path}</b>
                    <i className="ph-fill ph-lock-simple" />
                  </div>
                </div>
              </div>
            )}
            {tab === "settings" && (
              <div className="sf-editor-form settings [display:flex] [flex-direction:column] [gap:16px] [&.settings]:[gap:18px]">
                <label className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
                  <span>Slug</span>
                  <div className="sf-slug [display:flex] [align-items:center] [overflow:hidden] [border-radius:8px] bg-surface [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_b]:[padding-left:10px] [&_b]:[color:#aebab6] [&_b]:[font:400_13px_'Geist_Mono'] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[padding:9px_10px_9px_2px] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[font:13px_'Geist_Mono'] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
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
                <dl className="sf-page-meta [margin:0] [display:flex] [flex-direction:column] [gap:8px] [border-radius:10px] [padding:13px] [background:#fafcfa] [border:1px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[color:#e9ecf1] dark:[background:#242930] [&_dd]:[margin:0] [&_dd]:[font-weight:500] [&_dd]:text-ink dark:[&_dd]:[color:#e9ecf1] [&_div]:[display:flex] [&_div]:[align-items:center] [&_div]:[gap:10px] [&_div]:[font-size:12.5px] [&_dt]:[width:130px] [&_dt]:[flex:none] [&_dt]:text-ink-subtle dark:[&_dt]:[color:#79808b]">
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
                <label className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
                  <span>Preferred child template</span>
                  <NativeSelect
                    unstyled
                    className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
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
                <div className="sf-translations [display:flex] [flex-direction:column] [gap:8px] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:text-action [&_button]:[background:transparent] [&_button]:[border:0] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:10px] [&>div]:[border-radius:9px] [&>div]:[padding:9px_11px] [&>div]:[border:1px_solid_var(--sf-border)] dark:[&>div]:[border-color:#3d444e] dark:[&>div]:[color:#e9ecf1] dark:[&>div]:[background:#1d2126] [&>div>b]:[display:grid] [&>div>b]:[height:20px] [&>div>b]:[width:26px] [&>div>b]:[place-items:center] [&>div>b]:[border-radius:4px] [&>div>b]:bg-sunken [&>div>b]:text-ink-muted [&>div>b]:[font:700_10px_'Geist_Mono'] [&>div>i]:[color:#1f9d57] [&>div>span]:[flex:1] [&>div>span]:[overflow:hidden] [&>div>span]:[font-size:13px] [&>div>span]:[text-overflow:ellipsis] [&>div>span]:[white-space:nowrap] dark:[&>div>span]:[color:#e9ecf1] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
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
                <div className="sf-danger [display:flex] [flex-direction:column] [gap:10px] [padding-top:16px] [border-top:1px_solid_var(--sf-sunken)] dark:[border-color:#323841] [&>button]:[display:inline-flex] [&>button]:[height:38px] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[justify-content:center] [&>button]:[gap:7px] [&>button]:[border-radius:8px] [&>button]:bg-danger-soft [&>button]:[font-size:13px] [&>button]:[font-weight:600] [&>button]:text-danger [&>button]:[border:1px_solid_#eec6bc] dark:[&>button]:[border-color:#723c37] dark:[&>button]:[color:#f0857a] dark:[&>button]:[background:#321f1e] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:text-danger [&>span]:[text-transform:uppercase]">
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
        <div className="sf-editor-toast [position:fixed] [bottom:26px] [left:50%] [z-index:70] [display:flex] [animation:sf-editor-toast_0.2s_cubic-bezier(0.2,_0.8,_0.2,_1)] [align-items:center] [gap:11px] [border-radius:11px] [padding:12px_16px] [font-size:13px] [font-weight:600] [color:#fff] [box-shadow:0_14px_40px_rgba(23,_35,_38,_0.32)] [background:var(--sf-ink)] [&_i]:[font-size:18px] [&_i]:[color:#b994f8]">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
      {deleteOpen && (
        <div
          className="sf-editor-modal [position:fixed] [inset:0] [z-index:80] [display:grid] [place-items:center] [backdrop-filter:blur(2px)] [background:rgba(15,_27,_29,_0.42)] [&_h2]:[margin:14px_0_6px] [&_h2]:[font-size:18px] [&_p]:[margin:0] [&_p]:[font-size:13px] [&_p]:[line-height:1.5] [&_p]:text-ink-muted dark:[&_p]:[color:#a7aeb8] [&_section]:[display:flex] [&_section]:[width:390px] [&_section]:[max-width:calc(100vw_-_40px)] [&_section]:[flex-direction:column] [&_section]:[align-items:center] [&_section]:[border-radius:13px] [&_section]:bg-surface [&_section]:[padding:28px] [&_section]:[text-align:center] [&_section]:[box-shadow:0_24px_70px_rgba(23,_35,_38,_0.25)] dark:[&_section]:[color:#e9ecf1] dark:[&_section]:[background:#1d2126] [&_section>div]:[margin-top:20px] [&_section>div]:[display:flex] [&_section>div]:[gap:8px] [&_section>i]:[display:grid] [&_section>i]:[height:48px] [&_section>i]:[width:48px] [&_section>i]:[place-items:center] [&_section>i]:[border-radius:12px] [&_section>i]:bg-danger-soft [&_section>i]:[font-size:23px] [&_section>i]:text-danger"
          onMouseDown={(event) => event.target === event.currentTarget && setDeleteOpen(false)}
          role="presentation"
        >
          <section>
            <i className="ph ph-trash" />
            <h2>Delete this page?</h2>
            <p>This permanently removes the page and its content. This cannot be undone.</p>
            <div>
              <Button
                unstyled
                className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                unstyled
                className="sf-action danger [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
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
