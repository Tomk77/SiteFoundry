import {
  execute,
  GraphQLBoolean,
  GraphQLError,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType,
  parse,
  validate,
  valueFromASTUntyped,
  visit,
  type GraphQLFieldConfigMap,
  type GraphQLOutputType,
} from "graphql";

import {
  connection,
  resolvePage,
  type DeliveryBlock,
  type DeliveryBundle,
  type DeliveryContentField,
  type DeliveryContentRecord,
} from "@/domain/delivery";

import {
  DeliveryHttpError,
  jsonDeliveryResponse,
  loadDeliveryBundle,
  preflightResponse,
  problemResponse,
} from "./delivery-api.server";

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "A JSON value.",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (node, variables) => valueFromASTUntyped(node, variables),
});

const PageInfoType = new GraphQLObjectType({
  name: "PageInfo",
  fields: {
    endCursor: { type: GraphQLString },
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const SeoType = new GraphQLObjectType({
  name: "Seo",
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    socialImage: { type: GraphQLString },
  },
});

function blockFields(fields: Record<string, GraphQLOutputType>) {
  return {
    id: { type: new GraphQLNonNull(GraphQLID) },
    version: { type: new GraphQLNonNull(GraphQLInt) },
    ...Object.fromEntries(
      Object.entries(fields).map(([key, type]) => [
        key,
        { type, resolve: (block: DeliveryBlock) => block.data[key] ?? null },
      ]),
    ),
  };
}

function lines(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function columns(value: string, count: number) {
  const parts = value.split("|").map((part) => part.trim());
  if (parts.length <= count) return parts;

  return [...parts.slice(0, count - 1), parts.slice(count - 1).join(" | ")];
}

const StringListType = new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)));

function stringListField(key: string) {
  return {
    type: StringListType,
    resolve: (block: DeliveryBlock) => lines(block.data[key]),
  };
}

const MetricItemType = new GraphQLObjectType({
  name: "MetricItem",
  fields: {
    value: { type: new GraphQLNonNull(GraphQLString) },
    label: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const StepItemType = new GraphQLObjectType({
  name: "StepItem",
  fields: {
    icon: { type: new GraphQLNonNull(GraphQLString) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    body: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const RedirectExampleType = new GraphQLObjectType({
  name: "RedirectExample",
  fields: {
    source: { type: new GraphQLNonNull(GraphQLString) },
    destination: { type: new GraphQLNonNull(GraphQLString) },
    statusCode: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const LabelValueType = new GraphQLObjectType({
  name: "LabelValue",
  fields: {
    label: { type: new GraphQLNonNull(GraphQLString) },
    value: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const FaqItemType = new GraphQLObjectType({
  name: "FaqItem",
  fields: {
    question: { type: new GraphQLNonNull(GraphQLString) },
    answer: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const HeroBlockType = new GraphQLObjectType({
  name: "HeroBlock",
  fields: {
    ...blockFields({
      eyebrow: GraphQLString,
      headline: new GraphQLNonNull(GraphQLString),
      subheadline: GraphQLString,
      primaryLabel: GraphQLString,
      primaryUrl: GraphQLString,
      secondaryLabel: GraphQLString,
      secondaryUrl: GraphQLString,
      imageSrc: GraphQLString,
      imageAlt: GraphQLString,
      imageLabel: GraphQLString,
    }),
    highlights: stringListField("highlights"),
  },
});
const RichTextBlockType = new GraphQLObjectType({
  name: "RichTextBlock",
  fields: blockFields({ body: GraphQLString }),
});
const QuoteBlockType = new GraphQLObjectType({
  name: "QuoteBlock",
  fields: blockFields({ text: new GraphQLNonNull(GraphQLString), cite: GraphQLString }),
});
const ImageBlockType = new GraphQLObjectType({
  name: "ImageBlock",
  fields: blockFields({ alt: new GraphQLNonNull(GraphQLString), caption: GraphQLString }),
});
const CtaBlockType = new GraphQLObjectType({
  name: "CtaBlock",
  fields: blockFields({
    heading: new GraphQLNonNull(GraphQLString),
    body: GraphQLString,
    button: GraphQLString,
    primaryLabel: GraphQLString,
    primaryUrl: GraphQLString,
    secondaryLabel: GraphQLString,
    secondaryUrl: GraphQLString,
  }),
});
const MetricsBlockType = new GraphQLObjectType({
  name: "MetricsBlock",
  fields: {
    ...blockFields({ accessibleLabel: GraphQLString }),
    metrics: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(MetricItemType))),
      resolve: (block: DeliveryBlock) =>
        lines(block.data.items).map((line) => {
          const [value = "", label = ""] = columns(line, 2);

          return { value, label };
        }),
    },
  },
});
const StepsBlockType = new GraphQLObjectType({
  name: "StepsBlock",
  fields: {
    ...blockFields({
      eyebrow: GraphQLString,
      heading: new GraphQLNonNull(GraphQLString),
      introduction: GraphQLString,
    }),
    steps: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(StepItemType))),
      resolve: (block: DeliveryBlock) =>
        lines(block.data.items).map((line) => {
          const [icon = "", title = "", body = ""] = columns(line, 3);

          return { icon, title, body };
        }),
    },
  },
});
const FeatureBlockType = new GraphQLObjectType({
  name: "FeatureBlock",
  fields: {
    ...blockFields({
      eyebrow: GraphQLString,
      title: new GraphQLNonNull(GraphQLString),
      body: GraphQLString,
      icon: GraphQLString,
      visual: GraphQLString,
      imageSrc: GraphQLString,
      imageAlt: GraphQLString,
      recordTitle: GraphQLString,
      recordStatus: GraphQLString,
      codeLanguage: GraphQLString,
      code: GraphQLString,
    }),
    points: stringListField("points"),
    redirects: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RedirectExampleType))),
      resolve: (block: DeliveryBlock) =>
        lines(block.data.redirects).map((line) => {
          const [source = "", destination = "", statusCode = "301"] = columns(line, 3);

          return { source, destination, statusCode: Number(statusCode) === 302 ? 302 : 301 };
        }),
    },
    recordFields: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(LabelValueType))),
      resolve: (block: DeliveryBlock) =>
        lines(block.data.recordFields).map((line) => {
          const [label = "", value = ""] = columns(line, 2);

          return { label, value };
        }),
    },
  },
});
const PageListBlockType = new GraphQLObjectType({
  name: "PageListBlock",
  fields: {
    ...blockFields({
      eyebrow: GraphQLString,
      heading: new GraphQLNonNull(GraphQLString),
      body: GraphQLString,
      emptyTitle: GraphQLString,
      emptyBody: GraphQLString,
    }),
    maxItems: {
      type: new GraphQLNonNull(GraphQLInt),
      resolve: (block: DeliveryBlock) =>
        Math.max(1, Math.min(Number(block.data.maxItems) || 6, 24)),
    },
  },
});
const FaqBlockType = new GraphQLObjectType({
  name: "FaqBlock",
  fields: {
    ...blockFields({
      eyebrow: GraphQLString,
      heading: new GraphQLNonNull(GraphQLString),
    }),
    questions: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(FaqItemType))),
      resolve: (block: DeliveryBlock) =>
        lines(block.data.items).map((line) => {
          const [question = "", answer = ""] = columns(line, 2);

          return { question, answer };
        }),
    },
  },
});

const blockTypeNames: Record<DeliveryBlock["type"], string> = {
  hero: "HeroBlock",
  richtext: "RichTextBlock",
  quote: "QuoteBlock",
  image: "ImageBlock",
  cta: "CtaBlock",
  metrics: "MetricsBlock",
  steps: "StepsBlock",
  feature: "FeatureBlock",
  pageList: "PageListBlock",
  faq: "FaqBlock",
};

const PageBlockType = new GraphQLUnionType({
  name: "PageBlock",
  types: [
    HeroBlockType,
    RichTextBlockType,
    QuoteBlockType,
    ImageBlockType,
    CtaBlockType,
    MetricsBlockType,
    StepsBlockType,
    FeatureBlockType,
    PageListBlockType,
    FaqBlockType,
  ],
  resolveType: (block: DeliveryBlock) => blockTypeNames[block.type],
});

const PageType = new GraphQLObjectType({
  name: "Page",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    parentId: { type: GraphQLID },
    locale: { type: new GraphQLNonNull(GraphQLString) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    slug: { type: new GraphQLNonNull(GraphQLString) },
    path: { type: new GraphQLNonNull(GraphQLString) },
    templateName: { type: new GraphQLNonNull(GraphQLString) },
    templateKey: { type: GraphQLString },
    blocks: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PageBlockType))) },
    seo: { type: new GraphQLNonNull(SeoType) },
    preferredChildTemplate: { type: GraphQLString },
    revisionId: { type: new GraphQLNonNull(GraphQLID) },
    revisionVersion: { type: new GraphQLNonNull(GraphQLInt) },
    publishedAt: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    updatedAt: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const PageConnectionType = new GraphQLObjectType({
  name: "PageConnection",
  fields: {
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PageType))) },
    pageInfo: { type: new GraphQLNonNull(PageInfoType) },
    totalCount: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const LanguageType = new GraphQLObjectType({
  name: "Language",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    code: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    default: { type: new GraphQLNonNull(GraphQLBoolean) },
    urlPrefix: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const DomainType = new GraphQLObjectType({
  name: "PublicDomain",
  fields: {
    hostname: { type: new GraphQLNonNull(GraphQLString) },
    primary: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});

const SiteType = new GraphQLObjectType({
  name: "Site",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    key: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    timezone: { type: new GraphQLNonNull(GraphQLString) },
    domains: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(DomainType))) },
  },
});

const NavigationType = new GraphQLObjectType({
  name: "NavigationMenu",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    locale: { type: new GraphQLNonNull(GraphQLString) },
    location: { type: new GraphQLNonNull(GraphQLString) },
    items: { type: new GraphQLNonNull(JSONScalar) },
    publishedAt: { type: GraphQLString },
  },
});

const RedirectType = new GraphQLObjectType({
  name: "Redirect",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    locale: { type: new GraphQLNonNull(GraphQLString) },
    sourcePath: { type: new GraphQLNonNull(GraphQLString) },
    destinationPath: { type: new GraphQLNonNull(GraphQLString) },
    statusCode: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

function pascalCase(value: string) {
  const name = value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

  return /^\d/.test(name) ? `Type${name}` : name || "Content";
}

function camelCase(value: string) {
  const name = pascalCase(value);

  return `${name[0]?.toLowerCase() ?? "content"}${name.slice(1)}`;
}

function contentFieldType(field: DeliveryContentField): GraphQLOutputType {
  let type: GraphQLOutputType;
  if (field.type === "number") type = GraphQLFloat;
  else if (field.type === "toggle") type = GraphQLBoolean;
  else if (field.type === "tags") type = new GraphQLList(new GraphQLNonNull(GraphQLString));
  else type = GraphQLString;

  return field.required ? new GraphQLNonNull(type) : type;
}

function contentQueryType(bundle: DeliveryBundle) {
  const grouped = new Map<string, typeof bundle.contentTypes>();
  for (const contentType of bundle.contentTypes) {
    const definitions = grouped.get(contentType.slug) ?? [];
    definitions.push(contentType);
    grouped.set(contentType.slug, definitions);
  }

  const fields: GraphQLFieldConfigMap<unknown, unknown> = {
    _availableTypes: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      resolve: () => [...new Set(bundle.contentTypes.map((contentType) => contentType.slug))],
    },
  };

  for (const [slug, definitions] of grouped) {
    const fieldDefinitions = new Map(
      definitions.flatMap((definition) => definition.fields.map((field) => [field.key, field])),
    );
    const recordType = new GraphQLObjectType({
      name: `${pascalCase(slug)}Record`,
      fields: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        locale: { type: new GraphQLNonNull(GraphQLString) },
        revisionId: { type: new GraphQLNonNull(GraphQLID) },
        revisionVersion: { type: new GraphQLNonNull(GraphQLInt) },
        publishedAt: { type: new GraphQLNonNull(GraphQLString) },
        ...Object.fromEntries(
          [...fieldDefinitions].map(([key, field]) => [
            key,
            {
              type: contentFieldType(field),
              resolve: (record: DeliveryContentRecord) => record.values[key] ?? null,
            },
          ]),
        ),
      },
    });
    const connectionType = new GraphQLObjectType({
      name: `${pascalCase(slug)}Connection`,
      fields: {
        nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(recordType))) },
        pageInfo: { type: new GraphQLNonNull(PageInfoType) },
        totalCount: { type: new GraphQLNonNull(GraphQLInt) },
      },
    });
    fields[camelCase(slug)] = {
      type: new GraphQLNonNull(connectionType),
      args: {
        locale: { type: GraphQLString },
        first: { type: GraphQLInt, defaultValue: 20 },
        after: { type: GraphQLString },
      },
      resolve: (_source, args: { locale?: string; first: number; after?: string }) => {
        const records = definitions
          .filter((definition) => !args.locale || definition.locale === args.locale)
          .flatMap((definition) => definition.records);

        return connection(records, args.first, args.after);
      },
    };
  }

  return new GraphQLObjectType({ name: "ContentQueries", fields });
}

export function createDeliveryGraphQLSchema(bundle: DeliveryBundle) {
  const ContentQueriesType = contentQueryType(bundle);
  const QueryType = new GraphQLObjectType({
    name: "Query",
    fields: {
      site: { type: new GraphQLNonNull(SiteType), resolve: () => bundle.site },
      languages: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(LanguageType))),
        resolve: () => bundle.languages,
      },
      page: {
        type: PageType,
        args: { id: { type: GraphQLID }, url: { type: GraphQLString } },
        resolve: (_source, args: { id?: string; url?: string }) => {
          if (args.id) return bundle.pages.find((page) => page.id === args.id) ?? null;
          if (args.url) return resolvePage(bundle, args.url);

          throw new GraphQLError("Provide either id or url.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        },
      },
      pages: {
        type: new GraphQLNonNull(PageConnectionType),
        args: {
          locale: { type: GraphQLString },
          first: { type: GraphQLInt, defaultValue: 20 },
          after: { type: GraphQLString },
        },
        resolve: (_source, args: { locale?: string; first: number; after?: string }) =>
          connection(
            args.locale ? bundle.pages.filter((page) => page.locale === args.locale) : bundle.pages,
            args.first,
            args.after,
          ),
      },
      content: { type: new GraphQLNonNull(ContentQueriesType), resolve: () => ({}) },
      navigation: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(NavigationType))),
        args: { locale: { type: GraphQLString }, location: { type: GraphQLString } },
        resolve: (_source, args: { locale?: string; location?: string }) =>
          bundle.navigation.filter(
            (menu) =>
              (!args.locale || menu.locale === args.locale) &&
              (!args.location || menu.location === args.location),
          ),
      },
      redirects: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(RedirectType))),
        args: { locale: { type: GraphQLString } },
        resolve: (_source, args: { locale?: string }) =>
          args.locale
            ? bundle.redirects.filter((redirect) => redirect.locale === args.locale)
            : bundle.redirects,
      },
      media: { type: new GraphQLNonNull(JSONScalar), resolve: () => bundle.media },
    },
  });

  return new GraphQLSchema({ query: QueryType });
}

function enforceQueryLimits(source: string) {
  const document = parse(source);
  let depth = 0;
  let maximumDepth = 0;
  let fields = 0;
  visit(document, {
    SelectionSet: {
      enter: () => {
        depth += 1;
        maximumDepth = Math.max(maximumDepth, depth);
      },
      leave: () => {
        depth -= 1;
      },
    },
    Field: () => {
      fields += 1;
    },
  });
  if (maximumDepth > 12)
    throw new DeliveryHttpError("GraphQL query is too deep.", 400, "query_too_deep");
  if (fields > 250)
    throw new DeliveryHttpError("GraphQL query is too complex.", 400, "query_too_complex");

  return document;
}

type GraphQLRequestInput = {
  source: string;
  operationName?: string;
  variables?: Record<string, unknown>;
};

const maxRequestBytes = 100_000;

function parseJson(value: string, problem: DeliveryHttpError): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw problem;
  }
}

function variablesFromJson(value: string | null) {
  if (!value) return undefined;
  const parsed = parseJson(
    value,
    new DeliveryHttpError("The variables parameter is not valid JSON.", 400, "invalid_variables"),
  );

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

// Reads at most maxRequestBytes, whatever Content-Length claims (finding 3.7).
async function readLimitedBody(request: Request) {
  const tooLarge = new DeliveryHttpError("GraphQL request is too large.", 413, "request_too_large");
  if (Number(request.headers.get("content-length")) > maxRequestBytes) throw tooLarge;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxRequestBytes) {
      await reader.cancel();

      throw tooLarge;
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

async function graphQLInput(request: Request): Promise<GraphQLRequestInput> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const source = url.searchParams.get("query") ?? "";
    const rawVariables = url.searchParams.get("variables");

    return {
      source,
      operationName: url.searchParams.get("operationName") ?? undefined,
      variables: variablesFromJson(rawVariables),
    };
  }

  if (request.method !== "POST") {
    throw new DeliveryHttpError(
      "GraphQL accepts GET and POST requests only.",
      405,
      "method_not_allowed",
      "GET, POST, OPTIONS",
    );
  }

  const input = parseJson(
    await readLimitedBody(request),
    new DeliveryHttpError("GraphQL request body is not valid JSON.", 400, "invalid_request"),
  );
  if (!input || typeof input !== "object") {
    throw new DeliveryHttpError("GraphQL request body must be an object.", 400, "invalid_request");
  }

  const body = input as Record<string, unknown>;

  return {
    source: typeof body.query === "string" ? body.query : "",
    operationName: typeof body.operationName === "string" ? body.operationName : undefined,
    variables:
      body.variables && typeof body.variables === "object"
        ? (body.variables as Record<string, unknown>)
        : undefined,
  };
}

export async function handleDeliveryGraphQLRequest(request: Request, siteKey: string) {
  if (request.method === "OPTIONS") return preflightResponse(request);

  try {
    const bundle = await loadDeliveryBundle(request, siteKey);
    const input = await graphQLInput(request);
    if (!input.source)
      throw new DeliveryHttpError("A GraphQL query is required.", 400, "invalid_request");
    const schema = createDeliveryGraphQLSchema(bundle);
    const document = enforceQueryLimits(input.source);
    const validationErrors = validate(schema, document);
    const result = validationErrors.length
      ? { errors: validationErrors.map((error) => error.toJSON()) }
      : await execute({
          schema,
          document,
          operationName: input.operationName,
          variableValues: input.variables,
        });

    return await jsonDeliveryResponse(request, result, {
      status: validationErrors.length ? 400 : 200,
    });
  } catch (reason) {
    if (reason instanceof GraphQLError) {
      return await jsonDeliveryResponse(request, { errors: [reason.toJSON()] }, { status: 400 });
    }

    return problemResponse(request, reason);
  }
}
