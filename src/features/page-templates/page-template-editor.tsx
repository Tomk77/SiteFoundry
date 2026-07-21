import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createTemplateComponent,
  pageComponentRegistry,
  validatePageTemplate,
  type PageTemplateDefinition,
  type TemplateValue,
} from "@/lib/page-templates";
import { TemplateFieldEditor } from "./template-field-editor";

import { ensureIds, type Device, type Tab, withoutComponentId } from "./editor-model";
import { previewDocument } from "./preview-document";
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
    <main className="sf-template-editor [display:flex] [height:100vh] [width:100vw] [flex-direction:column] [overflow:hidden] bg-canvas text-ink [&_.sf-preview-stage]:[min-height:0] [&_.sf-preview-stage_iframe]:[border-radius:6px]">
      <header className="sf-template-editor-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:10px] bg-surface [padding:0_14px] [border-bottom:1px_solid_var(--sf-border)]">
        <Button onClick={onBack} size="sm" type="button" variant="outline">
          <i className="ph ph-arrow-left" /> Back to templates
        </Button>
        <div className="sf-template-editor-title [display:flex] [min-width:0] [align-items:center] [gap:8px] [&>b]:[display:inline-flex] [&>b]:[align-items:center] [&>b]:[gap:4px] [&>b]:[font-size:10.5px] [&>b]:text-concept max-[1080px]:[&>b]:[display:none] [&>span]:[border-radius:4px] [&>span]:bg-sunken [&>span]:[padding:1px_6px] [&>span]:[font-size:11px] [&>span]:text-ink-subtle [&>strong]:[max-width:190px] [&>strong]:[overflow:hidden] [&>strong]:[font-size:13.5px] [&>strong]:[text-overflow:ellipsis] [&>strong]:[white-space:nowrap]">
          <strong>{template.name}</strong>
          <span className="sf-mono [font-family:'Geist_Mono',_monospace]">{template.key}</span>
          <b>
            <i
              className={`ph-fill ${template.status === "published" ? "ph-check-circle" : "ph-pencil-simple"}`}
            />
            {template.status === "published" ? "Published" : "Draft"}
          </b>
        </div>
        {template.fallback ? (
          <span className="sf-template-role [display:inline-flex] [height:21px] [align-items:center] [gap:4px] [border-radius:5px] [padding:0_7px] [font-size:11px] [font-weight:600] [white-space:nowrap] [color:#33474a] [font-style:normal] [background:#dfe3e8] dark:[color:#c5cdd6] dark:[background:#333b44]">
            <i className="ph-fill ph-push-pin" /> Fallback
          </span>
        ) : null}
        <span
          className={`sf-template-valid [display:inline-flex] [height:22px] [align-items:center] [gap:5px] [border-radius:5px] bg-published-soft [padding:0_8px] [font-size:11.5px] [font-weight:600] text-published dark:[color:#54be88] dark:[background:#18302a] [&.issues]:bg-concept-soft [&.issues]:text-concept dark:[&.issues]:[color:#e1b444] dark:[&.issues]:[background:#312813] ${issues.length ? "issues" : ""}`}
        >
          <i className={`ph ${issues.length ? "ph-warning" : "ph-check-circle"}`} />
          {issues.length ? `${issues.length} ${issues.length === 1 ? "issue" : "issues"}` : "Valid"}
        </span>
        <span className="sf-spacer [flex:1]" />
        <span className="sf-template-saved [display:inline-flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle max-[1080px]:[display:none] [&_.ph-spinner]:[animation:sf-template-spin_0.7s_linear_infinite]">
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
      <div className="sf-template-editor-workspace [display:flex] [min-height:0] [flex:1]">
        <section className="sf-template-preview-pane [display:flex] [min-width:0] [flex:1] [flex-direction:column] bg-sunken">
          <div className="sf-template-preview-tools [display:flex] [height:48px] [flex:none] [align-items:center] [gap:12px] [padding:0_16px] [background:color-mix(in_srgb,_var(--sf-canvas)_56%,_var(--sf-surface))] [border-bottom:1px_solid_var(--sf-border)]">
            <div className="sf-device-toggle flex gap-0.5 rounded-lg bg-[#eaeeea] p-0.5 dark:bg-canvas [&_button]:grid [&_button]:h-7 [&_button]:w-[30px] [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-base [&_button]:text-ink-subtle [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:shadow-[0_1px_2px_rgb(23_35_38_/_14%)] dark:[&_button.active]:bg-selection dark:[&_button.active]:text-action dark:[&_button.active]:shadow-none">
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
            <div className="sf-preview-url flex h-8 max-w-[440px] min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 dark:border-field [&>b]:rounded-full [&>b]:bg-concept-soft [&>b]:px-1.5 [&>b]:py-px [&>b]:text-[10px] [&>b]:text-concept [&>i]:text-xs [&>i]:text-published [&>span]:flex-1 [&>span]:overflow-hidden [&>span]:font-mono [&>span]:text-xs [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:text-ink-muted">
              <i className="ph ph-eye" />
              <span>preview {template.preview}</span>
              <b>Dummy content</b>
            </div>
            <span className="sf-spacer [flex:1]" />
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
          <div className="sf-preview-stage sf-scroll [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            <iframe
              ref={iframeRef}
              srcDoc={previewDocument}
              title={`${template.name} preview`}
              style={{ width: device === "desktop" ? "100%" : device === "tablet" ? 820 : 390 }}
            />
          </div>
        </section>
        <aside className="sf-template-builder [display:flex] [min-height:0] [width:412px] [flex:none] [flex-direction:column] bg-surface [border-left:1px_solid_var(--sf-border)] max-[1080px]:[width:382px]">
          <div className="sf-template-tabs [display:flex] [flex:none] [gap:2px] [padding:8px_12px_0] [border-bottom:1px_solid_var(--sf-sunken)] [&_b]:[display:inline-flex] [&_b]:[height:16px] [&_b]:[min-width:16px] [&_b]:[align-items:center] [&_b]:[justify-content:center] [&_b]:[border-radius:999px] [&_b]:bg-concept-soft [&_b]:[padding:0_4px] [&_b]:[font-size:10px] [&_b]:text-concept [&_button]:[margin-bottom:-1px] [&_button]:[display:inline-flex] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[padding:8px_12px_10px] [&_button]:[font-size:13px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border-bottom:2px_solid_transparent] [&_button]:[border:0] [&_button.active]:border-action [&_button.active]:text-action">
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
              <div className="sf-template-builder-tools [display:flex] [height:43px] [flex:none] [align-items:center] [gap:10px] [padding:0_14px] [font-size:12px] text-ink-muted [border-bottom:1px_solid_var(--sf-sunken)] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:text-action [&_button]:[background:transparent] [&_button]:[border:0] [&>i]:[height:12px] [&>i]:[width:1px] [&>i]:[background:var(--sf-border)]">
                <span>
                  <strong>{template.components.length}</strong> components
                </span>
                <span className="sf-spacer [flex:1]" />
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
              <div className="sf-template-component-list sf-scroll [display:flex] [min-height:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [flex-direction:column] [gap:9px] [overflow:auto] [padding:14px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
                {!template.components.length ? (
                  <div className="sf-template-empty-builder [display:flex] [flex-direction:column] [align-items:center] [gap:9px] [border-radius:12px] [padding:32px_20px] [text-align:center] [background:color-mix(in_srgb,_var(--sf-canvas)_55%,_var(--sf-surface))] [border:1.5px_dashed_var(--sf-field)] [&>i]:[display:grid] [&>i]:[height:44px] [&>i]:[width:44px] [&>i]:[place-items:center] [&>i]:[border-radius:11px] [&>i]:bg-selection [&>i]:[font-size:22px] [&>i]:text-action [&>span]:[max-width:260px] [&>span]:[font-size:12.5px] [&>span]:[line-height:1.5] [&>span]:text-ink-muted">
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
                      className={cn(
                        "sf-template-component [flex:none] [overflow:hidden] [border-radius:10px] bg-surface [border:1.5px_solid_var(--sf-border)] [transition:border-color_0.12s,_box-shadow_0.12s] [&.dropping]:[box-shadow:inset_0_0_0_2px_var(--sf-accent)] [&.invalid]:[border-color:#eec6bc] [&.selected]:border-selection-border [&.selected>header]:bg-selection [&>header]:[display:flex] [&>header]:[cursor:pointer] [&>header]:[align-items:center] [&>header]:[gap:8px] [&>header]:bg-surface [&>header]:[padding:9px_9px_9px_7px]",
                        selected === component.id && "selected",
                        componentIssues.length > 0 && "invalid",
                        dropId === component.id && "dropping",
                      )}
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
                        <i className="ph-bold ph-dots-six-vertical sf-template-grab [cursor:grab] text-ink-subtle" />
                        <span className={`sf-block-icon ${definition?.iconClass ?? "unknown"}`}>
                          <i className={`ph ${definition?.icon ?? "ph-warning-octagon"}`} />
                        </span>
                        <span className="sf-template-component-copy [display:flex] [min-width:0] [flex-direction:column] [gap:1px] [&_small]:[overflow:hidden] [&_small]:[font-size:11px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:text-ink-subtle [&_strong]:[overflow:hidden] [&_strong]:[font-size:13px] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap]">
                          <strong>{definition?.label ?? "Unknown component"}</strong>
                          <small>{preview.slice(0, 46)}</small>
                        </span>
                        <span className="sf-spacer [flex:1]" />
                        {componentIssues.length ? (
                          <i className="ph-fill ph-warning-circle sf-template-warning text-danger" />
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
                          className={cn(
                            "ph ph-caret-down sf-template-caret text-ink-subtle [transition:transform_0.15s] [&.open]:[transform:rotate(180deg)]",
                            expanded[componentId] && "open",
                          )}
                        />
                      </header>
                      {expanded[componentId] ? (
                        <div className="sf-template-component-fields [display:flex] [flex-direction:column] [gap:13px] [padding:13px_12px_15px] [background:color-mix(in_srgb,_var(--sf-canvas)_55%,_var(--sf-surface))] [border-top:1px_solid_var(--sf-sunken)]">
                          {!definition ? (
                            <div className="sf-template-unknown [display:flex] [flex-direction:column] [align-items:flex-start] [gap:8px] [border-radius:9px] bg-danger-soft [padding:12px] [border:1px_solid_#eec6bc] dark:[border-color:#4a2e27] dark:[background:#3a2320] [&_span]:[font-size:12px] [&_span]:[line-height:1.5] [&_span]:text-ink-muted [&_strong]:[font-size:12.5px] [&_strong]:text-danger">
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
                <div className="sf-template-add [position:relative] [&>button]:[height:44px] [&>button]:[width:100%] [&>button]:[border-style:dashed] [&>button]:text-action">
                  <Button
                    onClick={() => setAddOpen((open) => !open)}
                    type="button"
                    variant="outline"
                  >
                    <i className="ph-bold ph-plus" /> Add component
                  </Button>
                  {addOpen ? (
                    <div className="sf-template-catalogue [position:absolute] [right:0] [bottom:52px] [left:0] [z-index:20] [animation:sf-template-pop_0.13s_ease] [border-radius:11px] bg-surface [padding:8px] [box-shadow:0_12px_34px_rgb(23_35_38_/_18%)] [border:1px_solid_var(--sf-border)] [&_section>b]:[display:block] [&_section>b]:[padding:8px_8px_3px] [&_section>b]:[font-size:10px] [&_section>b]:[letter-spacing:0.05em] [&_section>b]:text-ink-subtle [&_section>b]:[text-transform:uppercase] [&_section>button]:[display:flex] [&_section>button]:[width:100%] [&_section>button]:[cursor:pointer] [&_section>button]:[align-items:center] [&_section>button]:[gap:10px] [&_section>button]:[border-radius:7px] [&_section>button]:[padding:8px_9px] [&_section>button]:[text-align:left] [&_section>button]:[background:transparent] [&_section>button]:[border:0] [&_section>button:hover]:bg-canvas [&_section>button>span:last-child]:[display:flex] [&_section>button>span:last-child]:[min-width:0] [&_section>button>span:last-child]:[flex-direction:column] [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>.sf-scroll]:[max-height:300px] [&>.sf-scroll]:[overflow:auto]">
                      <div className="sf-template-catalogue-search [display:flex] [height:34px] [align-items:center] [gap:8px] [border-radius:8px] [padding:0_10px] [border:1.5px_solid_var(--sf-field)] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[font-size:12.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0]">
                        <i className="ph ph-magnifying-glass" />
                        <Input
                          unstyled
                          autoFocus
                          value={addQuery}
                          onChange={(event) => setAddQuery(event.target.value)}
                          placeholder="Search components for this site..."
                        />
                      </div>
                      <div className="sf-scroll [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
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
            <div className="sf-template-settings sf-scroll [display:flex] [min-height:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [flex-direction:column] [gap:17px] [overflow:auto] [padding:16px] [&_em]:[font-size:11.5px] [&_em]:text-danger [&_em]:[font-style:normal] [&_fieldset]:[margin:0] [&_fieldset]:[display:flex] [&_fieldset]:[flex-direction:column] [&_fieldset]:[gap:12px] [&_fieldset]:[border-radius:10px] [&_fieldset]:[padding:14px] [&_fieldset]:[border:1px_solid_var(--sf-border)] [&_legend]:[display:flex] [&_legend]:[align-items:center] [&_legend]:[gap:6px] [&_legend]:[padding:0_5px] [&_legend]:[font-size:11px] [&_legend]:[font-weight:600] [&_legend]:[letter-spacing:0.04em] [&_legend]:text-ink-subtle [&_legend]:[text-transform:uppercase] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
              <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                <span>Template name</span>
                <Input
                  unstyled
                  className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
                  value={template.name}
                  onChange={(event) => patch({ ...template, name: event.target.value })}
                />
              </div>
              <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                <span>Description</span>
                <Textarea
                  unstyled
                  className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
                  value={template.description}
                  onChange={(event) => patch({ ...template, description: event.target.value })}
                />
              </div>
              <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                <span>Availability</span>
                <NativeSelect
                  className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
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
              <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                <span>Stable key</span>
                <Input
                  unstyled
                  className="sf-template-input sf-mono [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-family:'Geist_Mono',_monospace] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
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
              <div className="sf-template-setting-field sf-template-fallback-setting [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase] [&>span:last-child]:[display:flex] [&>span:last-child]:[align-items:center] [&>span:last-child]:[gap:10px] [&>span:last-child]:[font-size:12.5px] [&>span:last-child]:text-ink-muted">
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
              <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                <span>Preview context path</span>
                <Input
                  unstyled
                  className="sf-template-input sf-mono [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-family:'Geist_Mono',_monospace] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
                  value={template.preview}
                  onChange={(event) => patch({ ...template, preview: event.target.value })}
                />
              </div>
              <fieldset>
                <legend>Page defaults</legend>
                <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                  <span>SEO title</span>
                  <Input
                    unstyled
                    className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
                    value={template.defaults.seoTitle}
                    onChange={(event) =>
                      patch({
                        ...template,
                        defaults: { ...template.defaults, seoTitle: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="sf-template-setting-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                  <span>SEO description</span>
                  <Textarea
                    unstyled
                    className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
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
              <div className="sf-template-independent-note [display:flex] [align-items:flex-start] [gap:10px] [border-radius:10px] [padding:12px] text-published [background:#eef8f2] [border:1px_solid_#b8dec9] dark:[border-color:#28533f] dark:[color:#54be88] dark:[background:#18302a] [&>i]:[font-size:18px] [&>span]:[display:flex] [&>span]:[flex-direction:column] [&>span]:[gap:2px] [&>span]:[font-size:12px] [&>span]:[line-height:1.45]">
                <i className="ph ph-shield-check" />
                <span>
                  <strong>Existing pages stay independent</strong>Changing this template never
                  updates pages already created from it.
                </span>
              </div>
              <section className="sf-template-revisions [&_h3]:[margin:0_0_10px] [&_h3]:[font-size:12px] [&_h3]:[text-transform:uppercase] [&_small]:text-ink-subtle [&>div]:[display:flex] [&>div]:[gap:10px] [&>div]:[padding:9px_0] [&>div]:[border-top:1px_solid_var(--sf-sunken)] [&>div>b]:text-action [&>div>b]:[font:600_11px_'Geist_Mono'] [&>div>span]:[display:flex] [&>div>span]:[flex-direction:column] [&>div>span]:[gap:2px] [&>div>span]:[font-size:12px]">
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
      <Modal
        className="sf-template-json-modal [width:min(680px,_calc(100vw_-_40px))] [&_pre]:[margin:0] [&_pre]:[max-height:66vh] [&_pre]:[overflow:auto] [&_pre]:bg-canvas [&_pre]:[padding:18px] [&_pre]:[white-space:pre-wrap] [&_pre]:text-ink [&_pre]:[font:12px/1.6_'Geist_Mono']"
        open={jsonOpen}
        onOpenChange={setJsonOpen}
      >
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
          <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
            Database snapshot · {template.key}
          </span>
          <ModalClose className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]">
            Close
          </ModalClose>
        </footer>
      </Modal>
    </main>
  );
}
