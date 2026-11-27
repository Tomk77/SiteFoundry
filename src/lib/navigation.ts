import type { Json } from "./database.types";
import { loadPageTreeWorkspace, type PageNode, type PageTreeWorkspace } from "./page-tree";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export type NavigationLocation = "header" | "footer";
export type NavigationKind = "link" | "group" | "button";
export type NavigationTargetType = "page" | "url";

export type NavigationItem = {
  id: string;
  kind: NavigationKind;
  label: string;
  target: string;
  targetType: NavigationTargetType;
  newTab: boolean;
  children: NavigationItem[];
};

export type NavigationWorkspace = PageTreeWorkspace & {
  menuId: string;
  location: NavigationLocation;
  items: NavigationItem[];
  publishedItems: NavigationItem[];
  publishedAt: string | null;
  pageOptions: { id: string; title: string; path: string }[];
};

function flattenPages(nodes: PageNode[]): { id: string; title: string; path: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, title: node.title, path: node.slug },
    ...flattenPages(node.children),
  ]);
}

function isNavigationItem(value: unknown): value is NavigationItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<NavigationItem>;

  return (
    typeof item.id === "string" &&
    ["link", "group", "button"].includes(String(item.kind)) &&
    typeof item.label === "string" &&
    typeof item.target === "string" &&
    ["page", "url"].includes(String(item.targetType)) &&
    typeof item.newTab === "boolean" &&
    Array.isArray(item.children) &&
    item.children.every(isNavigationItem)
  );
}

function parseItems(value: unknown): NavigationItem[] {
  return Array.isArray(value) ? value.filter(isNavigationItem) : [];
}

export function createNavigationItem(
  kind: NavigationKind,
  targetType: NavigationTargetType = "page",
): NavigationItem {
  const id = crypto.randomUUID();
  if (kind === "group") {
    return {
      id,
      kind,
      label: "New dropdown",
      target: "",
      targetType: "page",
      newTab: false,
      children: [
        {
          id: crypto.randomUUID(),
          kind: "link",
          label: "First link",
          target: "/about",
          targetType: "page",
          newTab: false,
          children: [],
        },
      ],
    };
  }

  return {
    id,
    kind,
    label: kind === "button" ? "New button" : "New link",
    target: targetType === "url" ? "https://" : "/about",
    targetType,
    newTab: false,
    children: [],
  };
}

export async function loadNavigationWorkspace(
  location: NavigationLocation,
  selection: { siteId?: string; languageId?: string } = {},
): Promise<NavigationWorkspace | null> {
  const workspace = await loadPageTreeWorkspace(selection);
  if (!workspace) return null;
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { data, error } = await client
    .from("navigation_menus")
    .select("id, location, draft_items, published_items, published_at, updated_at")
    .eq("site_language_id", workspace.language.id)
    .eq("location", location)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: created, error: createError } = await client
      .from("navigation_menus")
      .insert({ site_language_id: workspace.language.id, location })
      .select("id, location, draft_items, published_items, published_at, updated_at")
      .single();
    if (createError) throw createError;

    return {
      ...workspace,
      menuId: created.id,
      location,
      items: [],
      publishedItems: [],
      publishedAt: created.published_at,
      pageOptions: flattenPages(workspace.pages),
    };
  }

  return {
    ...workspace,
    menuId: data.id,
    location,
    items: parseItems(data.draft_items),
    publishedItems: parseItems(data.published_items),
    publishedAt: data.published_at,
    pageOptions: flattenPages(workspace.pages),
  };
}

export async function saveNavigationDraft(menuId: string, items: NavigationItem[]) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { data, error } = await client
    .from("navigation_menus")
    .update({ draft_items: items })
    .eq("id", menuId)
    .select("updated_at")
    .single();
  if (error) throw error;

  return data.updated_at;
}

export async function publishNavigation(menuId: string, items: NavigationItem[]) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  // The database publishes with its own clock and checks the publish permission.
  const { data, error } = await client.rpc("publish_navigation_menu", {
    target_menu_id: menuId,
    target_items: items as unknown as Json,
  });
  if (error) throw error;
  const result = data && typeof data === "object" && !Array.isArray(data) ? data : {};

  return {
    updated_at: typeof result.updatedAt === "string" ? result.updatedAt : "",
    published_at: typeof result.publishedAt === "string" ? result.publishedAt : null,
  };
}
