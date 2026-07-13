import {
  loadPageTreeWorkspace,
  type PageNode,
  type PageTreeWorkspace,
} from "./page-tree";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export type RedirectRecord = {
  id: string;
  siteLanguageId: string;
  pageId: string | null;
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302;
  createdAt: string;
  pageTitle: string | null;
};

export type RedirectWorkspace = PageTreeWorkspace & {
  redirects: RedirectRecord[];
  livePages: Array<{ id: string; title: string; path: string }>;
};

export type RedirectHealth =
  | { kind: "broken"; label: "Broken target"; detail: string }
  | { kind: "chained"; label: "Chained"; detail: string }
  | { kind: "loop"; label: "Loop"; detail: string };

function flattenPages(
  nodes: PageNode[],
): Array<{ id: string; title: string; path: string }> {
  return nodes.flatMap((node) => [
    { id: node.id, title: node.title, path: node.slug },
    ...flattenPages(node.children),
  ]);
}

export function normalizeRedirectPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return path.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
}

export function getRedirectHealth(
  redirect: RedirectRecord,
  livePaths: Set<string>,
  redirects: RedirectRecord[],
): RedirectHealth | null {
  const graph = new Map(
    redirects.map((item) => [item.sourcePath, item.destinationPath]),
  );
  const chained = graph.has(redirect.destinationPath);
  const seen = new Set([redirect.sourcePath]);
  let current = redirect.destinationPath;
  while (graph.has(current)) {
    if (seen.has(current)) {
      return {
        kind: "loop",
        label: "Loop",
        detail: "This redirect eventually points back to itself.",
      };
    }
    seen.add(current);
    current = graph.get(current) ?? current;
  }
  if (chained) {
    return {
      kind: "chained",
      label: "Chained",
      detail:
        "The destination is another redirect. Point directly to its final page.",
    };
  }
  if (!livePaths.has(redirect.destinationPath)) {
    return {
      kind: "broken",
      label: "Broken target",
      detail:
        "The destination does not match a live page in this language tree.",
    };
  }
  return null;
}

export async function loadRedirectWorkspace(
  selection: { siteId?: string; languageId?: string } = {},
): Promise<RedirectWorkspace | null> {
  const workspace = await loadPageTreeWorkspace(selection);
  if (!workspace) return null;
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { data, error } = await client
    .from("redirects")
    .select(
      "id, site_language_id, page_id, source_path, destination_path, status_code, created_at",
    )
    .eq("site_language_id", workspace.language.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const livePages = flattenPages(workspace.pages);
  const pageNames = new Map(livePages.map((page) => [page.id, page.title]));
  return {
    ...workspace,
    livePages,
    redirects: (data ?? []).map((item) => ({
      id: item.id,
      siteLanguageId: item.site_language_id,
      pageId: item.page_id,
      sourcePath: item.source_path,
      destinationPath: item.destination_path,
      statusCode: item.status_code === 302 ? 302 : 301,
      createdAt: item.created_at,
      pageTitle: item.page_id ? (pageNames.get(item.page_id) ?? null) : null,
    })),
  };
}

export async function saveRedirect(input: {
  id?: string;
  siteLanguageId: string;
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302;
}) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const payload = {
    source_path: normalizeRedirectPath(input.sourcePath),
    destination_path: normalizeRedirectPath(input.destinationPath),
    status_code: input.statusCode,
  };
  if (input.id) {
    const { error } = await client
      .from("redirects")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await client
    .from("redirects")
    .insert({
      ...payload,
      site_language_id: input.siteLanguageId,
      page_id: null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteRedirect(id: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error } = await client.from("redirects").delete().eq("id", id);
  if (error) throw error;
}
