import type { BlockType, ContentBlock } from "@/lib/page-editor";

import type { EditablePage, PageRevisionSnapshot } from "@/lib/page-editor";

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
