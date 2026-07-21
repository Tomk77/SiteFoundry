import type { BlockType, ContentBlock } from "@/lib/page-editor";

export type Tab = "content" | "seo" | "settings";
export type Device = "desktop" | "tablet" | "mobile";
interface FieldDefinition {
  key: string;
  label: string;
  type: "text" | "area";
  placeholder: string;
}
export const blockDefinitions: Record<
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
export const defaults: Record<BlockType, Record<string, string>> = {
  hero: { headline: "New headline" },
  richtext: { body: "" },
  quote: { text: "", cite: "" },
  image: { alt: "", caption: "" },
  cta: { heading: "Ready to start?", button: "Get started" },
};

export function nextBlockId(blocks: ContentBlock[]) {
  let suffix = blocks.length + 1;
  while (blocks.some((block) => block.id === `block-${suffix}`)) suffix += 1;
  return `block-${suffix}`;
}
