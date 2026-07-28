export type TemplateFieldType =
  | "text"
  | "richtext"
  | "number"
  | "choice"
  | "toggle"
  | "date"
  | "media"
  | "url"
  | "tags"
  | "reference";

export type TemplateValue = string | number | boolean | string[] | null;

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
}

export interface TemplateComponentDefinition {
  label: string;
  icon: string;
  category: string;
  description: string;
  iconClass: string;
  fields: TemplateFieldDefinition[];
}

export interface PageTemplateComponent {
  id?: string;
  type: string;
  values: Record<string, TemplateValue>;
}

export interface PageTemplateRevision {
  version: number;
  note: string;
  at: string;
}

export interface PageTemplateDefinition {
  id?: string;
  siteLanguageId?: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  status: "draft" | "published";
  fallback: boolean;
  defaults: {
    seoTitle: string;
    seoDescription: string;
  };
  preview: string;
  components: PageTemplateComponent[];
  revisions: PageTemplateRevision[];
  modifiedAt?: string;
  usageCount?: number;
}

export interface TemplateIssue {
  componentId?: string;
  componentIndex?: number;
  fieldKey?: string;
  message: string;
}

export const PAGE_TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

export const pageComponentRegistry: Record<string, TemplateComponentDefinition> = {
  hero: {
    label: "Hero",
    icon: "ph-identification-card",
    category: "Headers",
    description: "Eyebrow, headline, lead and image",
    iconClass: "hero",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Product news" },
      {
        key: "headline",
        label: "Headline",
        type: "text",
        required: true,
        placeholder: "Headline",
      },
      {
        key: "subheadline",
        label: "Subheadline",
        type: "richtext",
        placeholder: "Supporting sentence",
      },
      { key: "primaryLabel", label: "Primary button label", type: "text" },
      { key: "primaryUrl", label: "Primary button link", type: "url" },
      { key: "secondaryLabel", label: "Secondary button label", type: "text" },
      { key: "secondaryUrl", label: "Secondary button link", type: "url" },
      {
        key: "highlights",
        label: "Highlights",
        type: "richtext",
        help: "One item per line.",
      },
      { key: "imageSrc", label: "Image path", type: "text" },
      { key: "imageAlt", label: "Image alt text", type: "text" },
      { key: "imageLabel", label: "Image window label", type: "text" },
      { key: "align", label: "Alignment", type: "choice", options: ["Left", "Center"] },
      { key: "media", label: "Background image", type: "media" },
      { key: "fullBleed", label: "Full-bleed width", type: "toggle" },
    ],
  },
  richtext: {
    label: "Rich text",
    icon: "ph-text-align-left",
    category: "Content",
    description: "Formatted body copy",
    iconClass: "richtext",
    fields: [
      {
        key: "body",
        label: "Body",
        type: "richtext",
        required: true,
        placeholder: "Write the body...",
      },
    ],
  },
  quote: {
    label: "Pull quote",
    icon: "ph-quotes",
    category: "Content",
    description: "Highlighted quotation",
    iconClass: "quote",
    fields: [
      {
        key: "text",
        label: "Quote",
        type: "richtext",
        required: true,
        placeholder: "A memorable line",
      },
      { key: "cite", label: "Attribution", type: "text", placeholder: "Name, role" },
      { key: "variant", label: "Style", type: "choice", options: ["Bar", "Large", "Card"] },
    ],
  },
  image: {
    label: "Image",
    icon: "ph-image",
    category: "Media",
    description: "Figure with caption",
    iconClass: "image",
    fields: [
      { key: "media", label: "Image", type: "media", required: true },
      {
        key: "alt",
        label: "Alt text",
        type: "text",
        required: true,
        placeholder: "Describe the image",
        help: "Required for accessibility (WCAG AA).",
      },
      { key: "caption", label: "Caption", type: "text", placeholder: "Optional caption" },
      { key: "width", label: "Width", type: "choice", options: ["Inline", "Wide", "Full"] },
    ],
  },
  cta: {
    label: "Call to action",
    icon: "ph-cursor-click",
    category: "Conversion",
    description: "Heading, text and button",
    iconClass: "cta",
    fields: [
      {
        key: "heading",
        label: "Heading",
        type: "text",
        required: true,
        placeholder: "Ready to start?",
      },
      { key: "body", label: "Body", type: "richtext", placeholder: "One supporting line" },
      { key: "primaryLabel", label: "Primary button label", type: "text" },
      { key: "primaryUrl", label: "Primary button link", type: "url" },
      { key: "secondaryLabel", label: "Secondary button label", type: "text" },
      { key: "secondaryUrl", label: "Secondary button link", type: "url" },
      { key: "buttonLabel", label: "Legacy button label", type: "text" },
      { key: "buttonHref", label: "Legacy button link", type: "url" },
      {
        key: "style",
        label: "Button style",
        type: "choice",
        options: ["Primary", "Secondary", "Ghost"],
      },
      { key: "newTab", label: "Open in new tab", type: "toggle" },
    ],
  },
  metrics: {
    label: "Metrics",
    icon: "ph-chart-bar",
    category: "Content",
    description: "Compact product proof points",
    iconClass: "metrics",
    fields: [
      { key: "accessibleLabel", label: "Accessible label", type: "text" },
      {
        key: "items",
        label: "Metrics",
        type: "richtext",
        required: true,
        help: "One item per line: value | label.",
      },
    ],
  },
  steps: {
    label: "Steps",
    icon: "ph-list-numbers",
    category: "Content",
    description: "Section heading and process cards",
    iconClass: "steps",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "heading", label: "Heading", type: "text", required: true },
      { key: "introduction", label: "Introduction", type: "richtext" },
      {
        key: "items",
        label: "Steps",
        type: "richtext",
        required: true,
        help: "One item per line: icon | title | body.",
      },
    ],
  },
  feature: {
    label: "Feature",
    icon: "ph-sparkle",
    category: "Content",
    description: "Feature copy with a visual example",
    iconClass: "feature",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "body", label: "Body", type: "richtext" },
      { key: "points", label: "Benefits", type: "richtext", help: "One item per line." },
      {
        key: "icon",
        label: "Icon",
        type: "choice",
        options: ["tree", "redirect", "content", "api"],
      },
      {
        key: "visual",
        label: "Visual type",
        type: "choice",
        options: ["image", "redirects", "content", "code"],
      },
      { key: "imageSrc", label: "Image path", type: "text" },
      { key: "imageAlt", label: "Image alt text", type: "text" },
      { key: "redirects", label: "Redirect examples", type: "richtext" },
      { key: "recordTitle", label: "Record title", type: "text" },
      { key: "recordStatus", label: "Record status", type: "text" },
      { key: "recordFields", label: "Record fields", type: "richtext" },
      { key: "codeLanguage", label: "Code label", type: "text" },
      { key: "code", label: "Code", type: "richtext" },
    ],
  },
  pageList: {
    label: "Published page list",
    icon: "ph-cards",
    category: "Content",
    description: "Live cards from published CMS pages",
    iconClass: "page-list",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "heading", label: "Heading", type: "text", required: true },
      { key: "body", label: "Body", type: "richtext" },
      { key: "maxItems", label: "Maximum cards", type: "text" },
      { key: "emptyTitle", label: "Empty-state title", type: "text" },
      { key: "emptyBody", label: "Empty-state body", type: "richtext" },
    ],
  },
  faq: {
    label: "FAQ",
    icon: "ph-question",
    category: "Content",
    description: "Questions and answers",
    iconClass: "faq",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "heading", label: "Heading", type: "text", required: true },
      {
        key: "items",
        label: "Questions",
        type: "richtext",
        required: true,
        help: "One item per line: question | answer.",
      },
    ],
  },
};

export const templateFieldTypeMeta: Record<TemplateFieldType, { label: string; icon: string }> = {
  text: { label: "Text", icon: "ph-text-aa" },
  richtext: { label: "Rich text", icon: "ph-article" },
  number: { label: "Number", icon: "ph-hash" },
  choice: { label: "Choice", icon: "ph-list-checks" },
  toggle: { label: "Toggle", icon: "ph-toggle-left" },
  date: { label: "Date", icon: "ph-calendar-blank" },
  media: { label: "Media", icon: "ph-image" },
  url: { label: "URL", icon: "ph-link" },
  tags: { label: "Tags", icon: "ph-tag" },
  reference: { label: "Reference", icon: "ph-link-simple" },
};

export function slugifyTemplateKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createTemplateComponent(type: string): PageTemplateComponent {
  const definition = pageComponentRegistry[type];
  const values: Record<string, TemplateValue> = {};
  for (const field of definition?.fields ?? []) {
    values[field.key] =
      field.type === "toggle"
        ? false
        : field.type === "tags"
          ? []
          : field.type === "number"
            ? 0
            : field.type === "choice"
              ? (field.options?.[0] ?? "")
              : "";
  }

  return { id: crypto.randomUUID(), type, values };
}

function isEmpty(value: TemplateValue | undefined) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function validatePageTemplate(template: PageTemplateDefinition): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  if (template.fallback && template.status !== "published") {
    issues.push({ message: "The fallback template must be published." });
  }

  if (!PAGE_TEMPLATE_KEY_PATTERN.test(template.key)) {
    issues.push({
      message: "Keys use lowercase letters, numbers and hyphens, and start with a letter.",
    });
  }

  template.components.forEach((component, componentIndex) => {
    const definition = pageComponentRegistry[component.type];
    if (!definition) {
      issues.push({
        componentId: component.id,
        componentIndex,
        message: `Unknown component "${component.type}"`,
      });

      return;
    }

    for (const field of definition.fields) {
      const value = component.values[field.key];
      if (field.required && isEmpty(value)) {
        issues.push({
          componentId: component.id,
          componentIndex,
          fieldKey: field.key,
          message: `${field.label} is required`,
        });
      } else if (
        field.type === "url" &&
        !isEmpty(value) &&
        !/^(https?:\/\/|\/)/.test(String(value))
      ) {
        issues.push({
          componentId: component.id,
          componentIndex,
          fieldKey: field.key,
          message: "Use an absolute path or full URL",
        });
      }
    }
  });

  return issues;
}

export function cloneTemplateComponentsForPage(components: PageTemplateComponent[]) {
  return components.map((component) => ({
    id: crypto.randomUUID(),
    type: component.type,
    data: structuredClone(component.values),
  }));
}

export function templateComponentSummary(template: PageTemplateDefinition) {
  const counts = new Map<string, number>();
  for (const component of template.components) {
    const label = pageComponentRegistry[component.type]?.label ?? component.type;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts]
    .map(([label, count]) => (count > 1 ? `${label} × ${count}` : label))
    .join(", ");
}
