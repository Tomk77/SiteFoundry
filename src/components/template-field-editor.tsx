import { useState } from "react";
import type { TemplateFieldDefinition, TemplateValue } from "../lib/page-templates";
import { templateFieldTypeMeta } from "../lib/page-templates";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";

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
    <label className={`sf-template-field${error ? " has-error" : ""}`}>
      <span className="sf-template-field-label">
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
          className={`sf-template-input${field.type === "url" ? " sf-mono" : ""}`}
          type={field.type === "date" ? "date" : "text"}
          value={stringValue}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {field.type === "richtext" ? (
        <div className="sf-template-richtext">
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
            className="sf-template-input"
            value={stringValue}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : null}
      {field.type === "number" ? (
        <Input
          unstyled
          className="sf-template-input sf-template-number"
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      ) : null}
      {field.type === "choice" || field.type === "reference" ? (
        <NativeSelect
          unstyled
          className="sf-template-input"
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
        <span className="sf-template-toggle">
          <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
          {value === true ? "On" : "Off"}
        </span>
      ) : null}
      {field.type === "media" ? (
        <Button className="sf-template-media" type="button" variant="outline">
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
        <div className="sf-template-tags">
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
