import { useState } from "react";
import type { TemplateFieldDefinition, TemplateValue } from "../lib/page-templates";
import { templateFieldTypeMeta } from "../lib/page-templates";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";

export function TemplateFieldEditor({
  field,
  value,
  error,
  onChange,
}: {
  field: TemplateFieldDefinition;
  value: TemplateValue | undefined;
  error?: string;
  onChange: (value: TemplateValue) => void;
}) {
  const meta = templateFieldTypeMeta[field.type];
  const [tag, setTag] = useState("");
  const tags = Array.isArray(value) ? value : [];
  const stringValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return (
    <label
      className={cn(
        "sf-template-field [display:flex] [flex-direction:column] [gap:5px] [&_em]:[font-size:11.5px] [&_em]:text-danger [&_em]:[font-style:normal] [&_p]:[margin:0] [&_p]:[font-size:11px] [&_p]:[line-height:1.4] [&_p]:text-ink-subtle [&.has-error_.sf-template-input]:border-danger [&.has-error_.sf-template-media]:border-danger [&.has-error_.sf-template-richtext]:border-danger",
        error && "has-error",
      )}
    >
      <span className="sf-template-field-label [display:flex] [align-items:center] [gap:6px] [font-size:11px] [font-weight:600] [letter-spacing:0.04em] text-ink-subtle [text-transform:uppercase] [&_b]:text-action [&_small]:[display:inline-flex] [&_small]:[align-items:center] [&_small]:[gap:3px] [&_small]:[letter-spacing:0] [&_small]:text-ink-subtle [&_small]:[text-transform:none] [&_small]:[font:9.5px_'Geist_Mono'] [&>span]:[flex:1]">
        {field.label}
        {field.required ? <b>*</b> : null}
        <span />
        <small>
          <i className={`ph ${meta.icon}`} /> {meta.label}
        </small>
      </span>
      {field.type === "text" || field.type === "url" || field.type === "date" ? (
        <Input
          unstyled
          className={cn(
            "sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]",
            field.type === "url" && "sf-mono [font-family:'Geist_Mono',_monospace]",
          )}
          type={field.type === "date" ? "date" : "text"}
          value={stringValue}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {field.type === "richtext" ? (
        <div className="sf-template-richtext [overflow:hidden] [border-radius:8px] bg-surface [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&_textarea]:[min-height:72px] [&_textarea]:[border-radius:0] [&_textarea]:[box-shadow:none] [&_textarea]:[border:0] [&>div]:[display:flex] [&>div]:[gap:1px] [&>div]:[padding:4px_5px] [&>div]:[border-bottom:1px_solid_var(--sf-sunken)]">
          <div>
            {[
              ["ph-text-b", "Bold"],
              ["ph-text-italic", "Italic"],
              ["ph-list-bullets", "List"],
              ["ph-link-simple", "Link"],
            ].map(([icon, label]) => (
              <Button aria-label={label} key={label} size="icon-xs" type="button" variant="ghost">
                <i className={`ph ${icon}`} />
              </Button>
            ))}
          </div>
          <Textarea
            unstyled
            className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
            value={stringValue}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : null}
      {field.type === "number" ? (
        <Input
          unstyled
          className="sf-template-input sf-template-number [width:100%] [max-width:140px] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      ) : null}
      {field.type === "choice" || field.type === "reference" ? (
        <NativeSelect
          unstyled
          className="sf-template-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [textarea&]:[min-height:72px] [textarea&]:[resize:vertical]"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? (field.type === "reference" ? ["No default reference"] : [])).map(
            (option) => (
              <option key={option}>{option}</option>
            ),
          )}
        </NativeSelect>
      ) : null}
      {field.type === "toggle" ? (
        <span className="sf-template-toggle [display:flex] [align-items:center] [gap:10px] [font-size:12.5px] text-ink-muted">
          <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
          {value === true ? "On" : "Off"}
        </span>
      ) : null}
      {field.type === "media" ? (
        <Button
          className="sf-template-media [height:auto] [width:100%] [justify-content:flex-start] [border-style:dashed] [padding:10px] [white-space:normal] [&_small]:[font-weight:400] [&_small]:text-ink-subtle [&>span:first-child]:[display:grid] [&>span:first-child]:[height:44px] [&>span:first-child]:[width:44px] [&>span:first-child]:[place-items:center] [&>span:first-child]:[border-radius:7px] [&>span:first-child]:bg-sunken [&>span:first-child]:[font-size:19px] [&>span:first-child]:text-ink-subtle [&>span:last-child]:[display:flex] [&>span:last-child]:[flex-direction:column] [&>span:last-child]:[align-items:flex-start]"
          type="button"
          variant="outline"
        >
          <span>
            <i className="ph ph-image" />
          </span>
          <span>
            <strong>{stringValue || "No default image"}</strong>
            <small>Default media · pages can replace it</small>
          </span>
        </Button>
      ) : null}
      {field.type === "tags" ? (
        <div className="sf-template-tags [display:flex] [flex-wrap:wrap] [gap:6px] [border-radius:8px] bg-surface [padding:6px] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] [&_button]:[display:inline-flex] [&_button]:[height:23px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:4px] [&_button]:[border-radius:6px] [&_button]:bg-selection [&_button]:[padding:0_8px] [&_button]:[font-size:12px] [&_button]:text-ink [&_button]:[border:0] [&_input]:[min-width:92px] [&_input]:[flex:1] [&_input]:[font-size:12px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0]">
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(tags.filter((tagItem) => tagItem !== item))}
            >
              {item} <i className="ph ph-x" />
            </button>
          ))}
          <input
            value={tag}
            placeholder="Add tag..."
            onChange={(event) => setTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !tag.trim()) return;
              event.preventDefault();
              if (!tags.includes(tag.trim())) onChange([...tags, tag.trim()]);
              setTag("");
            }}
          />
        </div>
      ) : null}
      {error ? (
        <em>
          <i className="ph-fill ph-warning-circle" /> {error}
        </em>
      ) : null}
      {field.help ? <p>{field.help}</p> : null}
    </label>
  );
}
