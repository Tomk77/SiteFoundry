export type DeliveryBlock = {
  id: string;
  type:
    | "hero"
    | "richtext"
    | "quote"
    | "image"
    | "cta"
    | "metrics"
    | "steps"
    | "feature"
    | "pageList"
    | "faq";
  version: number;
  data: Record<string, string>;
};

export type DeliveryPage = {
  id: string;
  parentId: string | null;
  languageId: string;
  locale: string;
  title: string;
  slug: string;
  path: string;
  templateName: string;
  templateKey: string | null;
  blocks: DeliveryBlock[];
  seo: { title: string; description: string; socialImage: string | null };
  preferredChildTemplate: string | null;
  revisionId: string;
  revisionVersion: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryContentField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  primary: boolean;
  options: unknown[];
};

export type DeliveryContentRecord = {
  id: string;
  contentType: string;
  locale: string;
  values: Record<string, unknown>;
  revisionId: string;
  revisionVersion: number;
  publishedAt: string;
};

export type DeliveryContentType = {
  id: string;
  slug: string;
  name: string;
  singularName: string;
  description: string;
  locale: string;
  schemaVersion: number;
  schemaPublishedAt: string | null;
  fields: DeliveryContentField[];
  records: DeliveryContentRecord[];
};

export type DeliveryBundle = {
  site: {
    id: string;
    key: string;
    name: string;
    timezone: string;
    domains: Array<{ hostname: string; primary: boolean }>;
  };
  languages: Array<{
    id: string;
    code: string;
    name: string;
    default: boolean;
    urlPrefix: string;
  }>;
  pages: DeliveryPage[];
  contentTypes: DeliveryContentType[];
  navigation: Array<{
    id: string;
    locale: string;
    location: "header" | "footer";
    items: unknown[];
    publishedAt: string | null;
  }>;
  redirects: Array<{
    id: string;
    locale: string;
    sourcePath: string;
    destinationPath: string;
    statusCode: 301 | 302;
  }>;
  media: unknown[];
};

export type Connection<T> = {
  nodes: T[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  totalCount: number;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function blockType(value: unknown): DeliveryBlock["type"] | null {
  return value === "hero" ||
    value === "richtext" ||
    value === "quote" ||
    value === "image" ||
    value === "cta" ||
    value === "metrics" ||
    value === "steps" ||
    value === "feature" ||
    value === "pageList" ||
    value === "faq"
    ? value
    : null;
}

function parseBlock(value: unknown): DeliveryBlock | null {
  const block = object(value);
  const type = blockType(block.type);
  if (!text(block.id) || !type) return null;
  const rawData = object(block.data);

  return {
    id: text(block.id),
    type,
    version: Math.max(1, Number(block.version) || 1),
    data: Object.fromEntries(
      Object.entries(rawData).flatMap(([key, item]) =>
        typeof item === "string" ? [[key, item]] : [],
      ),
    ),
  };
}

function parsePage(value: unknown): DeliveryPage | null {
  const page = object(value);
  const id = text(page.id);
  const revisionId = text(page.revisionId);
  if (!id || !revisionId) return null;
  const seo = object(page.seo);

  return {
    id,
    parentId: nullableText(page.parentId),
    languageId: text(page.languageId),
    locale: text(page.locale),
    title: text(page.title),
    slug: text(page.slug),
    path: normalizePath(text(page.path, "/")),
    templateName: text(page.templateName),
    templateKey: nullableText(page.templateKey),
    blocks: list(page.blocks)
      .map(parseBlock)
      .filter((block) => block !== null),
    seo: {
      title: text(seo.title),
      description: text(seo.description),
      socialImage: nullableText(seo.socialImage),
    },
    preferredChildTemplate: nullableText(page.preferredChildTemplate),
    revisionId,
    revisionVersion: Math.max(1, Number(page.revisionVersion) || 1),
    publishedAt: text(page.publishedAt),
    createdAt: text(page.createdAt),
    updatedAt: text(page.updatedAt),
  };
}

function parseContentType(value: unknown): DeliveryContentType | null {
  const contentType = object(value);
  const slug = text(contentType.slug);
  if (!slug) return null;

  return {
    id: text(contentType.id),
    slug,
    name: text(contentType.name),
    singularName: text(contentType.singularName),
    description: text(contentType.description),
    locale: text(contentType.locale),
    schemaVersion: Math.max(1, Number(contentType.schemaVersion) || 1),
    schemaPublishedAt: nullableText(contentType.schemaPublishedAt),
    fields: list(contentType.fields).map((value) => {
      const field = object(value);

      return {
        key: text(field.key),
        label: text(field.label),
        type: text(field.type),
        required: Boolean(field.required),
        primary: Boolean(field.primary),
        options: list(field.options),
      };
    }),
    records: list(contentType.records).map((value) => {
      const record = object(value);

      return {
        id: text(record.id),
        contentType: text(record.contentType, slug),
        locale: text(record.locale, text(contentType.locale)),
        values: object(record.values),
        revisionId: text(record.revisionId),
        revisionVersion: Math.max(1, Number(record.revisionVersion) || 1),
        publishedAt: text(record.publishedAt),
      };
    }),
  };
}

export function parseDeliveryBundle(value: unknown): DeliveryBundle {
  const payload = object(value);
  const site = object(payload.site);
  const siteKey = text(site.key);
  if (!siteKey) throw new Error("The delivery data is missing its site key.");

  return {
    site: {
      id: text(site.id),
      key: siteKey,
      name: text(site.name),
      timezone: text(site.timezone),
      domains: list(site.domains).map((value) => {
        const domain = object(value);

        return { hostname: text(domain.hostname), primary: Boolean(domain.primary) };
      }),
    },
    languages: list(payload.languages).map((value) => {
      const language = object(value);

      return {
        id: text(language.id),
        code: text(language.code),
        name: text(language.name),
        default: Boolean(language.default),
        urlPrefix: text(language.urlPrefix),
      };
    }),
    pages: list(payload.pages)
      .map(parsePage)
      .filter((page) => page !== null),
    contentTypes: list(payload.contentTypes)
      .map(parseContentType)
      .filter((contentType) => contentType !== null),
    navigation: list(payload.navigation).map((value) => {
      const menu = object(value);

      return {
        id: text(menu.id),
        locale: text(menu.locale),
        location: menu.location === "footer" ? "footer" : "header",
        items: list(menu.items),
        publishedAt: nullableText(menu.publishedAt),
      };
    }),
    redirects: list(payload.redirects).map((value) => {
      const redirect = object(value);

      return {
        id: text(redirect.id),
        locale: text(redirect.locale),
        sourcePath: normalizePath(text(redirect.sourcePath)),
        destinationPath: normalizePath(text(redirect.destinationPath)),
        statusCode: Number(redirect.statusCode) === 302 ? 302 : 301,
      };
    }),
    media: list(payload.media),
  };
}

export function normalizePath(path: string) {
  const normalized = `/${path}`.replace(/\/{2,}/g, "/");

  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
}

export function resolvePage(bundle: DeliveryBundle, value: string) {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (!bundle.site.domains.some((domain) => domain.hostname === url.hostname)) return null;
    path = url.pathname;
  }

  path = normalizePath(decodeURIComponent(path.split(/[?#]/, 1)[0] || "/"));
  const language = [...bundle.languages]
    .filter(({ urlPrefix }) => urlPrefix)
    .sort((left, right) => right.urlPrefix.length - left.urlPrefix.length)
    .find(({ urlPrefix }) => path === `/${urlPrefix}` || path.startsWith(`/${urlPrefix}/`));
  const locale = language?.code ?? bundle.languages.find((item) => item.default)?.code;
  if (language) path = normalizePath(path.slice(language.urlPrefix.length + 1));

  return bundle.pages.find((page) => page.locale === locale && page.path === path) ?? null;
}

export class InvalidCursorError extends Error {
  constructor() {
    super("The pagination cursor is invalid.");
  }
}

function decodeCursor(cursor?: string | null) {
  if (!cursor) return 0;
  let value = Number.NaN;

  try {
    value = Number(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    throw new InvalidCursorError();
  }

  if (!Number.isSafeInteger(value) || value < 0) throw new InvalidCursorError();

  return value;
}

function encodeCursor(offset: number) {
  return btoa(String(offset)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function connection<T>(values: T[], first = 20, after?: string | null): Connection<T> {
  const size = Math.min(Math.max(Math.trunc(first) || 20, 1), 100);
  const offset = decodeCursor(after);
  const nodes = values.slice(offset, offset + size);
  const nextOffset = offset + nodes.length;

  return {
    nodes,
    pageInfo: {
      endCursor: nodes.length ? encodeCursor(nextOffset) : null,
      hasNextPage: nextOffset < values.length,
    },
    totalCount: values.length,
  };
}
