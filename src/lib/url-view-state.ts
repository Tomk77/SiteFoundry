export type PageTreeUrlSearch = {
  q?: string;
  status?: "published" | "concept";
  validation?: "problems";
  template?: string;
};

export type RedirectsUrlSearch = {
  q?: string;
  filter?: "automatic" | "manual" | "attention";
};

export type MediaUrlSearch = {
  q?: string;
  folder?: string;
  view?: "list";
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parsePageTreeUrlSearch(
  search: Record<string, unknown>,
): PageTreeUrlSearch {
  return {
    q: optionalString(search.q),
    status:
      search.status === "published" || search.status === "concept"
        ? search.status
        : undefined,
    validation: search.validation === "problems" ? "problems" : undefined,
    template: optionalString(search.template),
  };
}

export function createPageTreeUrlSearch(input: {
  q: string;
  status: "all" | "Published" | "Concept";
  validation: "all" | "problems";
  template: string;
}): PageTreeUrlSearch {
  return {
    q: input.q || undefined,
    status:
      input.status === "all"
        ? undefined
        : (input.status.toLowerCase() as "published" | "concept"),
    validation: input.validation === "all" ? undefined : input.validation,
    template: input.template === "all" ? undefined : input.template,
  };
}

export function parseRedirectsUrlSearch(
  search: Record<string, unknown>,
): RedirectsUrlSearch {
  return {
    q: optionalString(search.q),
    filter:
      search.filter === "automatic" ||
      search.filter === "manual" ||
      search.filter === "attention"
        ? search.filter
        : undefined,
  };
}

export function createRedirectsUrlSearch(input: {
  q: string;
  filter: "all" | "automatic" | "manual" | "attention";
}): RedirectsUrlSearch {
  return {
    q: input.q || undefined,
    filter: input.filter === "all" ? undefined : input.filter,
  };
}

export function parseMediaUrlSearch(
  search: Record<string, unknown>,
): MediaUrlSearch {
  return {
    q: optionalString(search.q),
    folder: optionalString(search.folder),
    view: search.view === "list" ? "list" : undefined,
  };
}

export function createMediaUrlSearch(input: {
  q: string;
  folder: string;
  view: "grid" | "list";
}): MediaUrlSearch {
  return {
    q: input.q || undefined,
    folder: input.folder === "root" ? undefined : input.folder,
    view: input.view === "grid" ? undefined : input.view,
  };
}
