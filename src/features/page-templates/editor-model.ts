import type { PageTemplateDefinition } from "@/lib/page-templates";

export type Device = "desktop" | "tablet" | "mobile";
export type Tab = "components" | "settings";

export function ensureIds(template: PageTemplateDefinition): PageTemplateDefinition {
  return {
    ...template,
    components: template.components.map((component) => ({
      ...component,
      id: component.id || crypto.randomUUID(),
      values: structuredClone(component.values),
    })),
  };
}

export function withoutComponentId(component: PageTemplateDefinition["components"][number]) {
  return { type: component.type, values: component.values };
}
