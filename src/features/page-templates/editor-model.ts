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

/**
 * Moves the item with `fromId` to the position of the item with `toId`: after it when moving down,
 * before it when moving up. Returns the list unchanged when either id is unknown (finding 7.10).
 */
export function moveToTarget<T extends { id?: string }>(items: T[], fromId: string, toId: string) {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  const moved = items[from];
  if (from < 0 || to < 0 || from === to || !moved) return items;
  const next = items.filter((_, index) => index !== from);
  next.splice(to, 0, moved);

  return next;
}
