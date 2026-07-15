import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import {
  createTemplateComponent,
  pageComponentRegistry,
  validatePageTemplate,
  type PageTemplateDefinition,
  type TemplateValue,
} from "../lib/page-templates";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "./modal";
import { TemplateFieldEditor } from "./template-field-editor";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

type Device = "desktop" | "tablet" | "mobile";
type Tab = "components" | "settings";

/* eslint-disable no-useless-escape -- Escaping the closing script tag keeps it inside srcDoc. */
const previewDocument = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Geist:wght@400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#1a1a1a;font-family:Geist,system-ui,sans-serif}article{max-width:720px;margin:0 auto;padding:52px 28px 96px}.blk{position:relative;outline:2px solid transparent;outline-offset:7px;border-radius:2px;cursor:pointer}.blk.sel{outline-color:#8a95a1}.blk+.blk{margin-top:30px}.eyebrow{margin:0 0 12px;color:#763fba;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}h1{margin:0 0 16px;font:600 40px/1.14 Newsreader,Georgia,serif}.sub{margin:0 0 22px;color:#525252;font-size:19px;line-height:1.5}.center{text-align:center}.ph{display:flex;aspect-ratio:16/9;align-items:center;justify-content:center;border-radius:10px;background:repeating-linear-gradient(135deg,#f1f2f4,#f1f2f4 11px,#e9ebee 11px,#e9ebee 22px);color:#9aa0aa;font-size:12px;font-weight:600}.body{margin:0 0 18px;color:#2a2a2a;font:18px/1.7 Newsreader,Georgia,serif}blockquote{margin:0;padding:6px 0 6px 22px;border-left:3px solid #763fba;font:500 24px/1.4 Newsreader,Georgia,serif}cite{display:block;margin-top:12px;color:#8a8a8a;font:600 13px Geist,sans-serif}.caption{margin:10px 2px 0;color:#8a8a8a;font-size:13px}.cta{padding:32px;border-radius:14px;background:#141a2e;color:#fff;text-align:center}.cta h3{margin:0 0 8px;font:600 26px Newsreader,serif}.cta p{margin:0 0 16px;color:#c7cbd6}.button{display:inline-block;padding:12px 22px;border-radius:8px;background:#763fba;font-weight:600}.empty{color:#b8b8b8;font-style:italic}.unknown{display:flex;align-items:center;gap:10px;padding:20px;border:1.5px dashed #d9a441;border-radius:10px;background:#fcf6e8;color:#8a5a06}.none{padding:80px 0;color:#b0b0b0;text-align:center}</style></head><body><div id="root"></div><script>var root=document.getElementById('root');function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}function val(value,placeholder){return String(value||'').trim()?esc(value):'<span class="empty">'+placeholder+'</span>'}function paragraphs(value){var items=String(value||'').split(/\\n\\n+/).filter(Boolean);return items.length?items.map(function(item){return '<p class="body">'+esc(item).replace(/\\n/g,'<br>')+'</p>'}).join(''):'<p class="body empty">Empty text</p>'}function render(data){var html='';(data.components||[]).forEach(function(component){var value=component.values||{},inner='';if(component.type==='hero')inner='<div class="'+(value.align==='Center'?'center':'')+'">'+(value.eyebrow?'<p class="eyebrow">'+esc(value.eyebrow)+'</p>':'')+'<h1>'+val(value.headline,'Untitled headline')+'</h1><p class="sub">'+val(value.subheadline,'Subheadline')+'</p></div><div class="ph">HERO IMAGE 16:9</div>';else if(component.type==='richtext')inner=paragraphs(value.body);else if(component.type==='quote')inner='<blockquote>“'+val(value.text,'Quote')+'”<cite>'+esc(value.cite||'')+'</cite></blockquote>';else if(component.type==='image')inner='<div class="ph">'+esc(value.alt||'IMAGE')+'</div>'+(value.caption?'<p class="caption">'+esc(value.caption)+'</p>':'');else if(component.type==='cta')inner='<div class="cta"><h3>'+val(value.heading,'Heading')+'</h3>'+(value.body?'<p>'+esc(value.body)+'</p>':'')+'<span class="button">'+esc(value.buttonLabel||'Button')+'</span></div>';else inner='<div class="unknown">⚠ Unknown component “'+esc(component.type)+'”</div>';html+='<section class="blk '+(component.id===data.selectedId?'sel':'')+'" data-id="'+component.id+'">'+inner+'</section>'});root.innerHTML='<article>'+(html||'<div class="none">Empty template · pages start blank.</div>')+'</article>';root.querySelectorAll('[data-id]').forEach(function(element){element.addEventListener('click',function(){parent.postMessage({source:'sf-template-preview',type:'select',id:element.dataset.id},'*')})})}window.addEventListener('message',function(event){if(event.data&&event.data.source==='sf-template-editor')render(event.data)});parent.postMessage({source:'sf-template-preview',type:'ready'},'*')<\/script></body></html>`;
/* eslint-enable no-useless-escape */

function ensureIds(template: PageTemplateDefinition): PageTemplateDefinition {
  return {
    ...template,
    components: template.components.map((component) => ({
      ...component,
      id: component.id || crypto.randomUUID(),
      values: structuredClone(component.values),
    })),
  };
}

function withoutComponentId(component: PageTemplateDefinition["components"][number]) {
  return { type: component.type, values: component.values };
}

export function PageTemplateEditor({
  initialTemplate,
  siteName,
  saving,
  onBack,
  onSave,
}: {
  initialTemplate: PageTemplateDefinition;
  siteName: string;
  saving: boolean;
  onBack: () => void;
  onSave: (template: PageTemplateDefinition) => Promise<void>;
}) {
  const [template, setTemplate] = useState(() => ensureIds(initialTemplate));
  const [tab, setTab] = useState<Tab>("components");
  const [device, setDevice] = useState<Device>("desktop");
  const [selected, setSelected] = useState(template.components[0]?.id ?? null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    template.components[0]?.id ? { [template.components[0].id]: true } : {},
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragId, setDragId] = useState("");
  const [dropId, setDropId] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const issues = useMemo(() => validatePageTemplate(template), [template]);
  const issueByComponent = useMemo(() => {
    const map = new Map<string, typeof issues>();
    for (const issue of issues) {
      if (!issue.componentId) continue;
      map.set(issue.componentId, [...(map.get(issue.componentId) ?? []), issue]);
    }
    return map;
  }, [issues]);
  const patch = (next: PageTemplateDefinition) => {
    setTemplate(next);
    setDirty(true);
  };
  const postPreview = () =>
    iframeRef.current?.contentWindow?.postMessage(
      { source: "sf-template-editor", components: template.components, selectedId: selected },
      "*",
    );
  useEffect(postPreview, [template.components, selected]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const rawMessage: unknown = event.data;
      if (!rawMessage || typeof rawMessage !== "object") return;
      const message = rawMessage as Record<string, unknown>;
      if (message.source !== "sf-template-preview") return;
      if (message.type === "ready") postPreview();
      if (message.type === "select" && typeof message.id === "string") {
        const id = message.id;
        setSelected(id);
        setExpanded((current) => ({ ...current, [id]: true }));
        setTab("components");
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  });
  const select = (id: string) => {
    setSelected(id);
    setExpanded((current) => ({ ...current, [id]: true }));
  };
  const updateComponent = (id: string, fieldKey: string, value: TemplateValue) =>
    patch({
      ...template,
      components: template.components.map((component) =>
        component.id === id
          ? { ...component, values: { ...component.values, [fieldKey]: value } }
          : component,
      ),
    });
  const move = (id: string, direction: number) => {
    const components = [...template.components];
    const from = components.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= components.length) return;
    [components[from], components[to]] = [components[to]!, components[from]!];
    patch({ ...template, components });
  };
  const drop = (event: DragEvent<HTMLDivElement>, id: string) => {
    event.preventDefault();
    if (!dragId || dragId === id) return setDropId("");
    const components = [...template.components];
    const from = components.findIndex((item) => item.id === dragId);
    const [moved] = components.splice(from, 1);
    const to = components.findIndex((item) => item.id === id);
    if (moved) components.splice(to, 0, moved);
    patch({ ...template, components });
    setDragId("");
    setDropId("");
  };
  const addGroups = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    const groups = new Map<string, [string, (typeof pageComponentRegistry)[string]][]>();
    for (const [key, definition] of Object.entries(pageComponentRegistry)) {
      if (query && !`${definition.label} ${definition.description}`.toLowerCase().includes(query)) {
        continue;
      }
      groups.set(definition.category, [
        ...(groups.get(definition.category) ?? []),
        [key, definition],
      ]);
    }
    return [...groups];
  }, [addQuery]);
  const json = JSON.stringify(
    {
      ...template,
      components: template.components.map(withoutComponentId),
      modifiedAt: undefined,
    },
    null,
    2,
  );
  const save = async () => {
    if (issues.length) {
      const first = issues[0];
      toast.warning(
        `Fix ${issues.length} ${issues.length === 1 ? "issue" : "issues"} before saving`,
        {
          description: first?.message,
        },
      );
      if (first?.componentId) {
        setTab("components");
        select(first.componentId);
        window.setTimeout(
          () =>
            document
              .querySelector(`[data-template-component="${first.componentId}"]`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" }),
          40,
        );
      } else setTab("settings");
      return;
    }
    try {
      await onSave(template);
      setDirty(false);
    } catch {
      // The route owns the user-facing error toast. Keep the editor dirty so
      // the author can retry without losing their changes.
    }
  };

  return (
    <main className="sf-template-editor">
      <header className="sf-template-editor-top">
        <Button onClick={onBack} size="sm" type="button" variant="outline">
          <i className="ph ph-arrow-left" /> Back to templates
        </Button>
        <div className="sf-template-editor-title">
          <strong>{template.name}</strong>
          <span className="sf-mono">{template.key}</span>
          <b>
            <i
              className={`ph-fill ${template.status === "published" ? "ph-check-circle" : "ph-pencil-simple"}`}
            />
            {template.status === "published" ? "Published" : "Draft"}
          </b>
        </div>
        {template.fallback ? (
          <span className="sf-template-role">
            <i className="ph-fill ph-push-pin" /> Fallback
          </span>
        ) : null}
        <span className={`sf-template-valid ${issues.length ? "issues" : ""}`}>
          <i className={`ph ${issues.length ? "ph-warning" : "ph-check-circle"}`} />
          {issues.length ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"}` : "Valid"}
        </span>
        <span className="sf-spacer" />
        <span className="sf-template-saved">
          <i
            className={`ph ${saving ? "ph-spinner" : dirty ? "ph-pencil-simple" : "ph-cloud-check"}`}
          />
          {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button onClick={() => setJsonOpen(true)} size="sm" type="button" variant="outline">
          <i className="ph ph-brackets-curly" /> View JSON
        </Button>
        <Button loading={saving} onClick={() => void save()} size="sm" type="button">
          <i className="ph ph-floppy-disk" /> Save template
        </Button>
      </header>
      <div className="sf-template-editor-workspace">
        <section className="sf-template-preview-pane">
          <div className="sf-template-preview-tools">
            <div className="sf-device-toggle">
              {(
                [
                  ["desktop", "ph-monitor"],
                  ["tablet", "ph-device-tablet"],
                  ["mobile", "ph-device-mobile"],
                ] as const
              ).map(([name, icon]) => (
                <Button
                  aria-label={name}
                  className={device === name ? "active" : ""}
                  key={name}
                  onClick={() => setDevice(name)}
                  type="button"
                  unstyled
                >
                  <i className={`ph-bold ${icon}`} />
                </Button>
              ))}
            </div>
            <div className="sf-preview-url">
              <i className="ph ph-eye" />
              <span>preview {template.preview}</span>
              <b>Dummy content</b>
            </div>
            <span className="sf-spacer" />
            <Button
              aria-label="Refresh preview"
              onClick={postPreview}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <i className="ph ph-arrow-clockwise" />
            </Button>
          </div>
          <div className="sf-preview-stage sf-scroll">
            <iframe
              ref={iframeRef}
              srcDoc={previewDocument}
              title={`${template.name} preview`}
              style={{ width: device === "desktop" ? "100%" : device === "tablet" ? 820 : 390 }}
            />
          </div>
        </section>
        <aside className="sf-template-builder">
          <div className="sf-template-tabs">
            <button
              className={tab === "components" ? "active" : ""}
              onClick={() => setTab("components")}
              type="button"
            >
              Components{" "}
              {issues.some((issue) => issue.componentId) ? (
                <b>{issues.filter((issue) => issue.componentId).length}</b>
              ) : null}
            </button>
            <button
              className={tab === "settings" ? "active" : ""}
              onClick={() => setTab("settings")}
              type="button"
            >
              Settings {issues.some((issue) => !issue.componentId) ? <b>1</b> : null}
            </button>
          </div>
          {tab === "components" ? (
            <>
              <div className="sf-template-builder-tools">
                <span>
                  <strong>{template.components.length}</strong> components
                </span>
                <span className="sf-spacer" />
                <button
                  onClick={() =>
                    setExpanded(
                      Object.fromEntries(template.components.map((item) => [item.id!, true])),
                    )
                  }
                  type="button"
                >
                  Expand all
                </button>
                <i />
                <button onClick={() => setExpanded({})} type="button">
                  Collapse all
                </button>
              </div>
              <div className="sf-template-component-list sf-scroll">
                {!template.components.length ? (
                  <div className="sf-template-empty-builder">
                    <i className="ph ph-stack-plus" />
                    <strong>Empty template</strong>
                    <span>
                      Pages made from this will start blank. Add the components new pages should
                      begin with.
                    </span>
                  </div>
                ) : null}
                {template.components.map((component, index) => {
                  const componentId = component.id ?? "";
                  const definition = pageComponentRegistry[component.type];
                  const componentIssues = issueByComponent.get(componentId) ?? [];
                  const primaryField =
                    definition?.fields.find((field) => field.required) ?? definition?.fields[0];
                  const preview = primaryField
                    ? String(component.values[primaryField.key] ?? definition?.description ?? "")
                    : "Not registered for this site";
                  return (
                    <div
                      className={`sf-template-component${selected === component.id ? " selected" : ""}${componentIssues.length ? " invalid" : ""}${dropId === component.id ? " dropping" : ""}`}
                      data-template-component={component.id}
                      draggable
                      key={component.id}
                      onDragEnd={() => {
                        setDragId("");
                        setDropId("");
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dragId && dragId !== componentId) setDropId(componentId);
                      }}
                      onDragStart={() => setDragId(componentId)}
                      onDrop={(event) => drop(event, componentId)}
                    >
                      <header
                        onClick={() => {
                          select(componentId);
                          setExpanded((current) => ({
                            ...current,
                            [componentId]: !current[componentId],
                          }));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          select(componentId);
                          setExpanded((current) => ({
                            ...current,
                            [componentId]: !current[componentId],
                          }));
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <i className="ph-bold ph-dots-six-vertical sf-template-grab" />
                        <span className={`sf-block-icon ${definition?.iconClass ?? "unknown"}`}>
                          <i className={`ph ${definition?.icon ?? "ph-warning-octagon"}`} />
                        </span>
                        <span className="sf-template-component-copy">
                          <strong>{definition?.label ?? "Unknown component"}</strong>
                          <small>{preview.slice(0, 46)}</small>
                        </span>
                        <span className="sf-spacer" />
                        {componentIssues.length ? (
                          <i className="ph-fill ph-warning-circle sf-template-warning" />
                        ) : null}
                        <Button
                          disabled={index === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            move(componentId, -1);
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <i className="ph-bold ph-arrow-up" />
                        </Button>
                        <Button
                          disabled={index === template.components.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            move(componentId, 1);
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <i className="ph-bold ph-arrow-down" />
                        </Button>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            const copy = {
                              ...component,
                              id: crypto.randomUUID(),
                              values: structuredClone(component.values),
                            };
                            const components = [...template.components];
                            components.splice(index + 1, 0, copy);
                            patch({ ...template, components });
                            select(copy.id);
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <i className="ph ph-copy" />
                        </Button>
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            patch({
                              ...template,
                              components: template.components.filter(
                                (item) => item.id !== component.id,
                              ),
                            });
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <i className="ph ph-trash" />
                        </Button>
                        <i
                          className={`ph ph-caret-down sf-template-caret${expanded[componentId] ? " open" : ""}`}
                        />
                      </header>
                      {expanded[componentId] ? (
                        <div className="sf-template-component-fields">
                          {!definition ? (
                            <div className="sf-template-unknown">
                              <strong>
                                <i className="ph-fill ph-warning-octagon" /> Unknown component “
                                {component.type}”
                              </strong>
                              <span>
                                This component is not registered for {siteName}. Its stored values
                                are preserved but cannot be edited here.
                              </span>
                              <Button
                                onClick={() =>
                                  patch({
                                    ...template,
                                    components: template.components.filter(
                                      (item) => item.id !== component.id,
                                    ),
                                  })
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Remove component
                              </Button>
                            </div>
                          ) : null}
                          {definition?.fields.map((field) => (
                            <TemplateFieldEditor
                              error={
                                componentIssues.find((issue) => issue.fieldKey === field.key)
                                  ?.message
                              }
                              field={field}
                              key={field.key}
                              value={component.values[field.key]}
                              onChange={(value) => updateComponent(componentId, field.key, value)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="sf-template-add">
                  <Button
                    onClick={() => setAddOpen((open) => !open)}
                    type="button"
                    variant="outline"
                  >
                    <i className="ph-bold ph-plus" /> Add component
                  </Button>
                  {addOpen ? (
                    <div className="sf-template-catalogue">
                      <div className="sf-template-catalogue-search">
                        <i className="ph ph-magnifying-glass" />
                        <Input
                          unstyled
                          autoFocus
                          value={addQuery}
                          onChange={(event) => setAddQuery(event.target.value)}
                          placeholder="Search components for this site..."
                        />
                      </div>
                      <div className="sf-scroll">
                        {addGroups.map(([category, items]) => (
                          <section key={category}>
                            <b>{category}</b>
                            {items.map(([key, definition]) => (
                              <button
                                key={key}
                                onClick={() => {
                                  const component = createTemplateComponent(key);
                                  patch({
                                    ...template,
                                    components: [...template.components, component],
                                  });
                                  select(component.id ?? "");
                                  setAddOpen(false);
                                  setAddQuery("");
                                }}
                                type="button"
                              >
                                <span className={`sf-block-icon ${definition.iconClass}`}>
                                  <i className={`ph ${definition.icon}`} />
                                </span>
                                <span>
                                  <strong>{definition.label}</strong>
                                  <small>{definition.description}</small>
                                </span>
                              </button>
                            ))}
                          </section>
                        ))}
                        {!addGroups.length ? (
                          <p>No registered components match this search.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="sf-template-settings sf-scroll">
              <div className="sf-template-setting-field">
                <span>Template name</span>
                <Input
                  unstyled
                  className="sf-template-input"
                  value={template.name}
                  onChange={(event) => patch({ ...template, name: event.target.value })}
                />
              </div>
              <div className="sf-template-setting-field">
                <span>Description</span>
                <Textarea
                  unstyled
                  className="sf-template-input"
                  value={template.description}
                  onChange={(event) => patch({ ...template, description: event.target.value })}
                />
              </div>
              <div className="sf-template-setting-field">
                <span>Availability</span>
                <NativeSelect
                  className="sf-template-input"
                  disabled={template.fallback}
                  value={template.status}
                  onChange={(event) =>
                    patch({
                      ...template,
                      status: event.target.value === "published" ? "published" : "draft",
                    })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </NativeSelect>
                <small>
                  {template.fallback
                    ? "The fallback must stay published."
                    : "Only published, valid templates can be used to create pages."}
                </small>
              </div>
              <div className="sf-template-setting-field">
                <span>Stable key</span>
                <Input
                  unstyled
                  className="sf-template-input sf-mono"
                  value={template.key}
                  onChange={(event) => patch({ ...template, key: event.target.value })}
                />
                {issues.find((issue) => !issue.componentId) ? (
                  <em>{issues.find((issue) => !issue.componentId)?.message}</em>
                ) : null}
                <small>
                  Used by page preferences and integrations. Existing pages remain independent.
                </small>
              </div>
              <div className="sf-template-setting-field sf-template-fallback-setting">
                <span>Language fallback</span>
                <span>
                  <Switch
                    checked={template.fallback}
                    onCheckedChange={(checked) => {
                      if (!checked && template.fallback) return;
                      patch({ ...template, fallback: checked });
                    }}
                  />
                  <span>
                    {template.fallback
                      ? "Used when no preferred template is set."
                      : "Make this the language's default starting point."}
                  </span>
                </span>
              </div>
              <div className="sf-template-setting-field">
                <span>Preview context path</span>
                <Input
                  unstyled
                  className="sf-template-input sf-mono"
                  value={template.preview}
                  onChange={(event) => patch({ ...template, preview: event.target.value })}
                />
              </div>
              <fieldset>
                <legend>Page defaults</legend>
                <div className="sf-template-setting-field">
                  <span>SEO title</span>
                  <Input
                    unstyled
                    className="sf-template-input"
                    value={template.defaults.seoTitle}
                    onChange={(event) =>
                      patch({
                        ...template,
                        defaults: { ...template.defaults, seoTitle: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="sf-template-setting-field">
                  <span>SEO description</span>
                  <Textarea
                    unstyled
                    className="sf-template-input"
                    value={template.defaults.seoDescription}
                    onChange={(event) =>
                      patch({
                        ...template,
                        defaults: { ...template.defaults, seoDescription: event.target.value },
                      })
                    }
                  />
                </div>
              </fieldset>
              <div className="sf-template-independent-note">
                <i className="ph ph-shield-check" />
                <span>
                  <strong>Existing pages stay independent</strong>Changing this template never
                  updates pages already created from it.
                </span>
              </div>
              <section className="sf-template-revisions">
                <h3>Revision history</h3>
                {template.revisions.map((revision) => (
                  <div key={`${revision.version}-${revision.at}`}>
                    <b>v{revision.version}</b>
                    <span>
                      <strong>{revision.note}</strong>
                      <small>{new Date(revision.at).toLocaleString()}</small>
                    </span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </aside>
      </div>
      <Modal className="sf-template-json-modal" open={jsonOpen} onOpenChange={setJsonOpen}>
        <header>
          <div>
            <ModalTitle>Template JSON</ModalTitle>
            <ModalDescription>
              Read-only preview of the current database definition.
            </ModalDescription>
          </div>
          <ModalClose>
            <i className="ph ph-x" />
          </ModalClose>
        </header>
        <pre>{json}</pre>
        <footer>
          <span className="sf-mono">Database snapshot · {template.key}</span>
          <ModalClose className="sf-action">Close</ModalClose>
        </footer>
      </Modal>
    </main>
  );
}
