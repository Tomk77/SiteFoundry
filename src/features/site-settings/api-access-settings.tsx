import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createSiteApiToken,
  listSiteApiTokens,
  revokeSiteApiToken,
  type SiteApiToken,
} from "@/lib/api-tokens";

import { GraphQLPlayground } from "./graphql-playground";
import { Field, SectionHeading, SettingsCard } from "./settings-layout";

function dateLabel(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function tokenStatus(token: SiteApiToken) {
  if (token.revokedAt) return "Revoked";
  if (token.expiresAt && new Date(token.expiresAt) <= new Date()) return "Expired";

  return "Active";
}

export function ApiAccessSettings({
  siteId,
  siteKey,
  canManage,
}: {
  siteId: string;
  siteKey: string;
  canManage: boolean;
}) {
  const [tokens, setTokens] = useState<SiteApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [origins, setOrigins] = useState("");
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  async function reload() {
    setError("");
    try {
      setTokens(await listSiteApiTokens(siteId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "API tokens could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManage) {
      setLoading(false);

      return;
    }

    setError("");
    void listSiteApiTokens(siteId)
      .then(setTokens)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "API tokens could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [canManage, siteId]);

  async function createToken() {
    if (!name.trim()) {
      setError("Give this token a recognizable name.");

      return;
    }

    setCreating(true);
    setError("");
    try {
      const createdSecret = await createSiteApiToken({
        siteId,
        name,
        allowedOrigins: origins,
        expiresAt,
      });
      setSecret(createdSecret);
      setName("");
      setExpiresAt("");
      setOrigins("");
      await reload();
      toast.success("Publishable token created");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The token could not be created.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
        <SectionHeading
          description="Create browser-safe credentials for the published REST and GraphQL delivery APIs."
          title="API access"
        />

        {secret ? (
          <div className="rounded-panel border border-concept/40 bg-concept-soft p-5" role="status">
            <div className="flex items-start justify-between gap-4 max-[620px]:flex-col">
              <div>
                <h3 className="m-0 text-sm font-semibold text-ink">Copy this token now</h3>
                <p className="mt-1 mb-3 text-xs leading-5 text-ink-muted">
                  It will not be shown again. This is a publishable key and may be included in a
                  browser application; it never grants draft or administration access.
                </p>
                <code className="block max-w-full overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-xs text-ink">
                  {secret}
                </code>
              </div>
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(secret);
                  toast.success("Token copied");
                }}
                type="button"
              >
                <i aria-hidden className="ph ph-copy" /> Copy
              </Button>
            </div>
            <button
              className="mt-3 border-0 bg-transparent p-0 text-xs font-semibold text-action"
              onClick={() => setSecret(null)}
              type="button"
            >
              I have saved this token
            </button>
          </div>
        ) : null}

        {canManage ? (
          <SettingsCard
            description="Tokens are site-scoped and currently read published content only."
            icon="ph-key"
            title="Create publishable token"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Production website"
                  value={name}
                />
              </Field>
              <Field hint="Leave empty for no automatic expiration." label="Expires">
                <Input
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="date"
                  value={expiresAt}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  hint="One origin per line, for example https://www.example.com. Leave empty to allow any browser origin. Server and build requests do not send an Origin header."
                  label="Allowed browser origins"
                >
                  <Textarea
                    onChange={(event) => setOrigins(event.target.value)}
                    placeholder={"https://www.example.com\nhttp://localhost:3000"}
                    rows={3}
                    value={origins}
                  />
                </Field>
              </div>
            </div>
            {error ? <p className="mt-3 mb-0 text-xs text-danger">{error}</p> : null}
            <div className="mt-4 flex justify-end">
              <Button
                disabled={creating || !name.trim()}
                onClick={() => void createToken()}
                type="button"
              >
                <i aria-hidden className="ph ph-plus" />
                {creating ? "Creating…" : "Create token"}
              </Button>
            </div>
          </SettingsCard>
        ) : (
          <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-ink-muted">
            You can inspect API access, but an owner or administrator must manage tokens.
          </p>
        )}

        {canManage ? (
          <SettingsCard
            description={`Use these credentials with /api/v1/sites/${siteKey}.`}
            icon="ph-plugs-connected"
            title="Publishable tokens"
          >
            {loading ? <p className="m-0 text-xs text-ink-muted">Loading tokens…</p> : null}
            {!loading && !tokens.length ? (
              <p className="m-0 text-xs text-ink-muted">No API tokens have been created yet.</p>
            ) : null}
            <div className="flex flex-col gap-3">
              {tokens.map((token) => {
                const status = tokenStatus(token);

                return (
                  <article
                    className="rounded-lg border border-border bg-surface p-4"
                    key={token.id}
                  >
                    <div className="flex items-start justify-between gap-4 max-[620px]:flex-col">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-ink">{token.name}</strong>
                          <span className="rounded-md bg-sunken px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                            {status}
                          </span>
                        </div>
                        <code className="mt-1.5 block font-mono text-xs text-ink-muted">
                          {token.displayToken}
                        </code>
                        <p className="mt-2 mb-0 text-[11px] leading-5 text-ink-subtle">
                          Created {dateLabel(token.createdAt)} · Last used{" "}
                          {dateLabel(token.lastUsedAt)} · Expires {dateLabel(token.expiresAt)}
                        </p>
                        <p className="mt-0.5 mb-0 text-[11px] text-ink-subtle">
                          {token.allowedOrigins.length
                            ? `Origins: ${token.allowedOrigins.join(", ")}`
                            : "Browser origins: unrestricted"}
                        </p>
                      </div>
                      {canManage && status === "Active" ? (
                        <Button
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Revoke ${token.name}? Requests using it will fail immediately.`,
                              )
                            )
                              return;
                            void revokeSiteApiToken(token.id)
                              .then(reload)
                              .then(() => toast.success("Token revoked"))
                              .catch((reason: unknown) =>
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : "The token could not be revoked.",
                                ),
                              );
                          }}
                          type="button"
                          variant="outline"
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </SettingsCard>
        ) : null}
      </div>

      <GraphQLPlayground initialToken={secret} siteKey={siteKey} />
    </div>
  );
}
