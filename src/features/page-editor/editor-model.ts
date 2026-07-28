import type { BlockType, ContentBlock } from "@/lib/page-editor";

import type { EditablePage, PageRevisionSnapshot } from "@/lib/page-editor";

export type Tab = "content" | "seo" | "settings";
export type Device = "desktop" | "tablet" | "mobile";

interface FieldDefinition {
  key: string;
  label: string;
  type: "text" | "area" | "select";
  placeholder: string;
  help?: string;
  options?: Array<{ label: string; value: string }>;
}

interface BlockDefinition {
  label: string;
  icon: string;
  description: string;
  fields: FieldDefinition[];
}

const lineListHelp = "Enter one item per line.";

export const blockDefinitions: Record<BlockType, BlockDefinition> = {
  hero: {
    label: "Hero",
    icon: "ph-identification-card",
    description: "Headline, actions, highlights and media",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Product news" },
      { key: "headline", label: "Headline", type: "text", placeholder: "Headline" },
      {
        key: "subheadline",
        label: "Subheadline",
        type: "area",
        placeholder: "Supporting sentence",
      },
      {
        key: "primaryLabel",
        label: "Primary button label",
        type: "text",
        placeholder: "Explore the CMS",
      },
      {
        key: "primaryUrl",
        label: "Primary button link",
        type: "text",
        placeholder: "/help/getting-started",
      },
      {
        key: "secondaryLabel",
        label: "Secondary button label",
        type: "text",
        placeholder: "See live CMS data",
      },
      {
        key: "secondaryUrl",
        label: "Secondary button link",
        type: "text",
        placeholder: "#live-content",
      },
      {
        key: "highlights",
        label: "Highlights",
        type: "area",
        placeholder: "Website-native",
        help: lineListHelp,
      },
      {
        key: "imageSrc",
        label: "Image path",
        type: "text",
        placeholder: "/screenshots/page-tree-dark.png",
      },
      {
        key: "imageAlt",
        label: "Image alt text",
        type: "text",
        placeholder: "Describe the product screenshot",
      },
      {
        key: "imageLabel",
        label: "Image window label",
        type: "text",
        placeholder: "localhost:4000/pages",
      },
    ],
  },
  richtext: {
    label: "Rich text",
    icon: "ph-text-align-left",
    description: "Body copy paragraphs",
    fields: [{ key: "body", label: "Body", type: "area", placeholder: "Write the body…" }],
  },
  quote: {
    label: "Pull quote",
    icon: "ph-quotes",
    description: "Highlighted quotation",
    fields: [
      { key: "text", label: "Quote", type: "area", placeholder: "A memorable line" },
      { key: "cite", label: "Attribution", type: "text", placeholder: "Name, role" },
    ],
  },
  image: {
    label: "Image",
    icon: "ph-image",
    description: "Figure with caption",
    fields: [
      { key: "alt", label: "Alt text", type: "text", placeholder: "Describe the image" },
      { key: "caption", label: "Caption", type: "text", placeholder: "Optional caption" },
    ],
  },
  cta: {
    label: "Call to action",
    icon: "ph-cursor-click",
    description: "Heading, copy and two actions",
    fields: [
      { key: "heading", label: "Heading", type: "text", placeholder: "Ready to start?" },
      { key: "body", label: "Body", type: "area", placeholder: "One supporting sentence" },
      {
        key: "primaryLabel",
        label: "Primary button label",
        type: "text",
        placeholder: "Get started",
      },
      {
        key: "primaryUrl",
        label: "Primary button link",
        type: "text",
        placeholder: "/help/getting-started",
      },
      {
        key: "secondaryLabel",
        label: "Secondary button label",
        type: "text",
        placeholder: "Read the docs",
      },
      {
        key: "secondaryUrl",
        label: "Secondary button link",
        type: "text",
        placeholder: "/help",
      },
    ],
  },
  metrics: {
    label: "Metrics",
    icon: "ph-chart-bar",
    description: "Compact product proof points",
    fields: [
      {
        key: "accessibleLabel",
        label: "Accessible label",
        type: "text",
        placeholder: "Product capabilities",
      },
      {
        key: "items",
        label: "Metrics",
        type: "area",
        placeholder: "{pageCount} | published pages connected",
        help: "One item per line: value | label. {pageCount} inserts the published page count.",
      },
    ],
  },
  steps: {
    label: "Steps",
    icon: "ph-list-numbers",
    description: "Section heading and process cards",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "How it works" },
      {
        key: "heading",
        label: "Heading",
        type: "text",
        placeholder: "From content model to live website in four moves.",
      },
      {
        key: "introduction",
        label: "Introduction",
        type: "area",
        placeholder: "Supporting paragraphs",
        help: "Separate paragraphs with a blank line.",
      },
      {
        key: "items",
        label: "Steps",
        type: "area",
        placeholder: "database | Run the CMS | Start the administration app...",
        help: "One item per line: icon | title | body.",
      },
    ],
  },
  feature: {
    label: "Feature",
    icon: "ph-sparkle",
    description: "Feature copy with a visual example",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Canonical page tree" },
      { key: "title", label: "Title", type: "text", placeholder: "Feature title" },
      { key: "body", label: "Body", type: "area", placeholder: "Feature description" },
      {
        key: "points",
        label: "Benefits",
        type: "area",
        placeholder: "Visible hierarchy and paths",
        help: lineListHelp,
      },
      {
        key: "icon",
        label: "Icon",
        type: "select",
        placeholder: "",
        options: [
          { label: "Page tree", value: "tree" },
          { label: "Redirect", value: "redirect" },
          { label: "Structured content", value: "content" },
          { label: "API", value: "api" },
        ],
      },
      {
        key: "visual",
        label: "Visual type",
        type: "select",
        placeholder: "",
        options: [
          { label: "Image", value: "image" },
          { label: "Redirect examples", value: "redirects" },
          { label: "Content record", value: "content" },
          { label: "Code sample", value: "code" },
        ],
      },
      { key: "imageSrc", label: "Image path", type: "text", placeholder: "/screenshots/..." },
      { key: "imageAlt", label: "Image alt text", type: "text", placeholder: "Describe the image" },
      {
        key: "redirects",
        label: "Redirect examples",
        type: "area",
        placeholder: "/old | /new | 301",
        help: "One item per line: source | destination | status.",
      },
      { key: "recordTitle", label: "Record title", type: "text", placeholder: "Team member" },
      { key: "recordStatus", label: "Record status", type: "text", placeholder: "Published" },
      {
        key: "recordFields",
        label: "Record fields",
        type: "area",
        placeholder: "Name | Amina Yusuf",
        help: "One item per line: label | value.",
      },
      { key: "codeLanguage", label: "Code label", type: "text", placeholder: "GraphQL" },
      { key: "code", label: "Code", type: "area", placeholder: "query WebsitePage..." },
    ],
  },
  pageList: {
    label: "Published page list",
    icon: "ph-cards",
    description: "Live cards from published CMS pages",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Live from GraphQL" },
      { key: "heading", label: "Heading", type: "text", placeholder: "Published routes" },
      {
        key: "body",
        label: "Body",
        type: "area",
        placeholder: "Connected to {siteName}.",
        help: "{siteName} inserts the current website name.",
      },
      { key: "maxItems", label: "Maximum cards", type: "text", placeholder: "6" },
      { key: "emptyTitle", label: "Empty-state title", type: "text", placeholder: "No pages yet" },
      {
        key: "emptyBody",
        label: "Empty-state body",
        type: "area",
        placeholder: "Publish a page to show it here.",
      },
    ],
  },
  faq: {
    label: "FAQ",
    icon: "ph-question",
    description: "Questions and answers",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "FAQ" },
      { key: "heading", label: "Heading", type: "text", placeholder: "Questions, answered." },
      {
        key: "items",
        label: "Questions",
        type: "area",
        placeholder: "Question | Answer",
        help: "One item per line: question | answer.",
      },
    ],
  },
};

export const defaults: Record<BlockType, Record<string, string>> = {
  hero: {
    headline: "New headline",
    primaryLabel: "",
    primaryUrl: "",
    secondaryLabel: "",
    secondaryUrl: "",
    highlights: "",
    imageSrc: "",
    imageAlt: "",
    imageLabel: "",
  },
  richtext: { body: "" },
  quote: { text: "", cite: "" },
  image: { alt: "", caption: "" },
  cta: {
    heading: "Ready to start?",
    body: "",
    primaryLabel: "Get started",
    primaryUrl: "/contact",
    secondaryLabel: "",
    secondaryUrl: "",
  },
  metrics: { accessibleLabel: "Product capabilities", items: "" },
  steps: { eyebrow: "", heading: "", introduction: "", items: "" },
  feature: {
    eyebrow: "",
    title: "",
    body: "",
    points: "",
    icon: "tree",
    visual: "image",
    imageSrc: "",
    imageAlt: "",
    redirects: "",
    recordTitle: "",
    recordStatus: "",
    recordFields: "",
    codeLanguage: "",
    code: "",
  },
  pageList: {
    eyebrow: "",
    heading: "",
    body: "",
    maxItems: "6",
    emptyTitle: "",
    emptyBody: "",
  },
  faq: { eyebrow: "FAQ", heading: "", items: "" },
};

export function nextBlockId(blocks: ContentBlock[]) {
  let suffix = blocks.length + 1;
  while (blocks.some((block) => block.id === `block-${suffix}`)) suffix += 1;

  return `block-${suffix}`;
}

export function countPageChanges(page: EditablePage, published: PageRevisionSnapshot | null) {
  if (!published) return 0;

  const scalarChanges = [
    page.title !== published.title,
    page.slug !== published.slug,
    page.seoTitle !== published.seoTitle,
    page.seoDescription !== published.seoDescription,
    page.socialImage !== published.socialImage,
    page.preferredChildTemplate !== published.preferredChildTemplate,
  ].filter(Boolean).length;
  const blockChanges = Array.from({
    length: Math.max(page.blocks.length, published.blocks.length),
  }).filter(
    (_, index) =>
      JSON.stringify(
        page.blocks[index]
          ? {
              id: page.blocks[index].id,
              type: page.blocks[index].type,
              data: page.blocks[index].data,
            }
          : null,
      ) !==
      JSON.stringify(
        published.blocks[index]
          ? {
              id: published.blocks[index].id,
              type: published.blocks[index].type,
              data: published.blocks[index].data,
            }
          : null,
      ),
  ).length;

  return scalarChanges + blockChanges;
}
