# Delivery API quick start

Create a publishable token under **Site Settings → API access**. The complete token is shown once.
The same screen embeds Apollo Sandbox for browsing the schema, building queries with autocomplete, and
inspecting responses. Paste the token and connect; newly created tokens are connected automatically.

```bash
curl \
  -H "Authorization: Bearer scaffold_pub_REPLACE_ME" \
  "http://localhost:4000/api/v1/sites/my-site/pages/resolve?url=/about"
```

```bash
curl \
  -H "Authorization: Bearer scaffold_pub_REPLACE_ME" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ page(url: \"/about\") { id title path blocks { __typename ... on HeroBlock { headline } } } }"}' \
  "http://localhost:4000/api/v1/sites/my-site/graphql"
```

Browser applications may use these publishable keys. Configure allowed origins to reduce casual
cross-site reuse, but do not treat origin checks or publishable tokens as protection for secret data.
Never use a future preview token in browser code.
