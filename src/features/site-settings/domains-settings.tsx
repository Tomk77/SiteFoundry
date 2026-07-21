import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SiteSettingsWorkspace } from "@/lib/site-settings";

import { Field, SectionHeading, SettingsCard } from "./settings-layout";

export function DomainsSettings({
  readOnly,
  domains,
  previewUrl: initialPreviewUrl,
  languages,
  onAdd,
  onVerify,
  onSetPrimary,
  onSavePreview,
}: {
  readOnly: boolean;
  domains: SiteSettingsWorkspace["domains"];
  previewUrl: string;
  languages: SiteSettingsWorkspace["languages"];
  onAdd: (hostname: string) => Promise<void>;
  onVerify: (domainId: string) => Promise<void>;
  onSetPrimary: (domainId: string) => Promise<void>;
  onSavePreview: (previewUrl: string) => Promise<void>;
}) {
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [newDomain, setNewDomain] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const primaryHost = domains.find((domain) => domain.isPrimary)?.hostname ?? "example.com";

  function addDomain() {
    setSaving(true);
    void onAdd(newDomain)
      .then(() => {
        setNewDomain("");
        setAddOpen(false);
        toast.success("Domain added");
      })
      .catch((reason: unknown) =>
        toast.error(reason instanceof Error ? reason.message : "Could not add the domain."),
      )
      .finally(() => setSaving(false));
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionHeading
        description="Connect production domains and configure where editors preview content."
        title="Domains & preview"
      />
      <div className="flex flex-col gap-4">
        <SettingsCard
          description="Domains that serve the published website."
          icon="ph-globe-hemisphere-west"
          title="Production domains"
        >
          {domains.length ? (
            <div className="divide-y divide-border">
              {domains.map((domain) => {
                const verified = domain.status === "verified";
                const statusLabel = {
                  verified: "Verified",
                  verification_pending: "Verification pending",
                  misconfigured: "Misconfigured",
                  not_connected: "Not connected",
                }[domain.status];

                return (
                  <article
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 max-[620px]:flex-wrap"
                    key={domain.id}
                  >
                    <span
                      className={
                        verified
                          ? "grid size-9 place-items-center rounded-lg bg-published-soft text-published"
                          : "grid size-9 place-items-center rounded-lg bg-danger-soft text-danger"
                      }
                    >
                      <i
                        aria-hidden
                        className={verified ? "ph ph-globe-hemisphere-west" : "ph ph-warning"}
                      />
                    </span>
                    <div className="min-w-[220px] flex-1">
                      <strong className="font-mono text-[12px]">{domain.hostname}</strong>
                      {domain.isPrimary ? (
                        <span className="ml-2 rounded-md bg-selection px-1.5 py-0.5 text-[9.5px] font-semibold text-action">
                          Primary
                        </span>
                      ) : null}
                      <small
                        className={
                          verified
                            ? "mt-1 flex items-center gap-1 text-[10.5px] text-published"
                            : "mt-1 flex items-center gap-1 text-[10.5px] text-danger"
                        }
                      >
                        <i
                          aria-hidden
                          className={verified ? "ph ph-check-circle" : "ph ph-warning-circle"}
                        />
                        {statusLabel}
                        {domain.verificationMessage ? ` · ${domain.verificationMessage}` : ""}
                      </small>
                    </div>
                    {!readOnly ? (
                      <div className="flex gap-1">
                        {!verified ? (
                          <Button
                            onClick={() =>
                              void onVerify(domain.id)
                                .then(() => toast.info("Verification requested"))
                                .catch((reason: unknown) =>
                                  toast.error(
                                    reason instanceof Error
                                      ? reason.message
                                      : "Could not request verification.",
                                  ),
                                )
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Verify
                          </Button>
                        ) : null}
                        {!domain.isPrimary ? (
                          <Button
                            aria-label={`Make ${domain.hostname} primary`}
                            onClick={() => void onSetPrimary(domain.id)}
                            size="icon-xs"
                            title="Make primary"
                            type="button"
                            variant="ghost"
                          >
                            <i aria-hidden className="ph ph-star" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg bg-sunken p-4 text-[11.5px] text-ink-muted">
              No production domains are connected yet.
            </div>
          )}
          {!readOnly ? (
            <Button
              className="mt-4"
              onClick={() => setAddOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <i aria-hidden className="ph-bold ph-plus" /> Add domain
            </Button>
          ) : null}
        </SettingsCard>

        <SettingsCard
          description="The website used for draft and concept previews."
          icon="ph-monitor-play"
          title="Preview environment"
        >
          <Field
            hint="SiteFoundry adds a short-lived preview token when opening a page."
            label="Preview website URL"
          >
            <Input
              disabled={readOnly}
              onChange={(event) => setPreviewUrl(event.target.value)}
              type="url"
              value={previewUrl}
            />
          </Field>
          <div className="mt-3 rounded-lg bg-sunken p-3 text-[11px] text-ink-muted">
            <span className="font-semibold text-ink">Example preview URL</span>
            <div className="mt-1 overflow-hidden font-mono text-ellipsis whitespace-nowrap">
              {previewUrl || "https://preview.example.com"}/about?sf-preview=••••••••
            </div>
          </div>
          {!readOnly ? (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() =>
                  void onSavePreview(previewUrl)
                    .then(() => toast.success("Preview settings saved"))
                    .catch((reason: unknown) =>
                      toast.error(
                        reason instanceof Error
                          ? reason.message
                          : "Could not save preview settings.",
                      ),
                    )
                }
                size="sm"
                type="button"
              >
                Save preview settings
              </Button>
            </div>
          ) : null}
        </SettingsCard>

        <SettingsCard
          description="How production URLs combine with language prefixes."
          icon="ph-link"
          title="URL behavior"
        >
          <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-[11.5px]">
            {languages.map((language) => (
              <div className="contents" key={language.id}>
                <span className="text-ink-subtle">{language.name}</span>
                <code>
                  https://{primaryHost}/{language.urlPrefix}about
                </code>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Add domain</DialogTitle>
            <DialogDescription className="text-[12px] text-ink-muted">
              Connect a hostname after configuring its DNS records.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            <Field hint="Enter a hostname without https:// or a path." label="Domain">
              <Input
                autoFocus
                onChange={(event) => setNewDomain(event.target.value)}
                placeholder="www.example.com"
                value={newDomain}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button disabled={!newDomain.trim()} loading={saving} onClick={addDomain} type="button">
              Add domain
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
