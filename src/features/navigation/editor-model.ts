import type { NavigationItem } from "@/lib/navigation";

export type Device = "desktop" | "tablet" | "mobile";

export const itemTheme = {
  link: { icon: "ph-link-simple", bg: "#eceef1", fg: "#763fba" },
  group: { icon: "ph-columns", bg: "#EDE7F5", fg: "#5B4B8A" },
  button: { icon: "ph-cursor-click", bg: "#FBEBE1", fg: "#B45F38" },
} as const;

export function move<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

export function allItems(items: NavigationItem[]) {
  return items.flatMap((item) => [item, ...item.children]);
}

export function parentOf(items: NavigationItem[], childId: string) {
  return items.find((item) => item.children.some((child) => child.id === childId));
}
