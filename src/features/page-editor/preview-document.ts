import type { ContentBlock } from "@/lib/page-editor";

const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/* eslint-disable no-useless-escape -- The escaped closing script tag is intentional inside srcDoc. */
export function previewDocument(blocks: ContentBlock[]) {
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
