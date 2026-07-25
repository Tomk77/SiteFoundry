import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

import { Field, SectionHeading, SettingsCard } from "./settings-layout";

type GeneralForm = {
  name: string;
  identifier: string;
  language: string;
  timezone: string;
};

export function GeneralSettings({
  readOnly,
  site,
  languages,
  onSave,
}: {
  readOnly: boolean;
  site: { name: string; slug: string; timezone: string };
  languages: Array<{ id: string; code: string; name: string; isDefault: boolean }>;
  onSave: (form: GeneralForm & { defaultLanguageId: string }) => Promise<void>;
}) {
  const initialForm = useMemo(
    () => ({
      name: site.name,
      identifier: site.slug,
      language:
        languages.find((language) => language.isDefault)?.code ?? languages[0]?.code ?? "en",
      timezone: site.timezone,
    }),
    [languages, site.name, site.slug, site.timezone],
  );
  const [saved, setSaved] = useState(initialForm);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const datePreview = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: form.timezone,
      }).format(new Date()),
    [form.timezone],
  );

  function update<K extends keyof GeneralForm>(key: K, value: GeneralForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionHeading
        description="Manage the identity and regional defaults used throughout this website."
        title="General"
      />
      {readOnly ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-border bg-sunken px-3.5 py-3 text-[12px] text-ink-muted">
          <i aria-hidden className="ph ph-eye mt-0.5 text-action" />
          You can view these settings, but an owner or administrator must change them.
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        <SettingsCard
          description="How this website is identified inside Scaffold CMS and integrations."
          icon="ph-identification-card"
          title="Website identity"
        >
          <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-5 max-[620px]:grid-cols-1">
            <div className="flex flex-col items-center gap-2">
              <span className="grid size-16 place-items-center rounded-[14px] bg-clay text-xl font-bold text-ink">
                NJ
              </span>
              {!readOnly ? (
                <Button size="xs" type="button" variant="outline">
                  Replace
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Website name">
                <Input
                  disabled={readOnly}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  value={form.name}
                />
              </Field>
              <Field
                hint="Used by integrations. Changing it may require updates outside Scaffold CMS."
                label="Internal identifier"
              >
                <Input
                  className="font-mono"
                  disabled={readOnly}
                  onChange={(event) => update("identifier", event.target.value)}
                  value={form.identifier}
                />
              </Field>
              {form.identifier !== saved.identifier ? (
                <p className="m-0 flex items-start gap-2 rounded-lg bg-concept-soft p-2.5 text-[11.5px] text-concept">
                  <i aria-hidden className="ph ph-warning mt-0.5" /> Confirm integrations before
                  changing this identifier.
                </p>
              ) : null}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          description="Defaults for new content and timestamps shown to editors."
          icon="ph-globe-hemisphere-west"
          title="Regional defaults"
        >
          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <Field label="Default content language">
              <div className="relative">
                <NativeSelect
                  disabled={readOnly}
                  onChange={(event) => update("language", event.target.value)}
                  value={form.language}
                >
                  {languages.map((language) => (
                    <option key={language.id} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </NativeSelect>
                <i
                  aria-hidden
                  className="ph ph-caret-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs"
                />
              </div>
            </Field>
            <Field label="Time zone">
              <div className="relative">
                <NativeSelect
                  disabled={readOnly}
                  onChange={(event) => update("timezone", event.target.value)}
                  value={form.timezone}
                >
                  <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New York</option>
                </NativeSelect>
                <i
                  aria-hidden
                  className="ph ph-caret-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs"
                />
              </div>
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-sunken px-3 py-2.5 text-[11.5px] text-ink-muted">
            <i aria-hidden className="ph ph-clock" /> Date and time preview:{" "}
            <strong className="font-medium text-ink">{datePreview}</strong>
          </div>
        </SettingsCard>

        <SettingsCard
          description="A preview of this website in the website selector."
          icon="ph-eye"
          title="Appearance preview"
        >
          <div className="bg-rail flex max-w-[360px] items-center gap-3 rounded-card border border-border p-3 shadow-control">
            <span className="grid size-9 place-items-center rounded-lg bg-clay text-xs font-bold">
              NJ
            </span>
            <span className="flex flex-col">
              <strong className="text-[13px]">{form.name || "Untitled website"}</strong>
              <small className="text-[11px] text-ink-subtle">
                {form.language === "nl"
                  ? "Dutch · NL"
                  : form.language === "de"
                    ? "German · DE"
                    : "English · EN"}
              </small>
            </span>
          </div>
        </SettingsCard>
      </div>
      {dirty && !readOnly ? (
        <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 rounded-t-card border border-border bg-surface px-4 py-3 shadow-[0_-8px_24px_rgb(23_35_38_/_10%)]">
          <span className="text-[12px] font-medium text-ink-muted">You have unsaved changes</span>
          <div className="flex gap-2">
            <Button onClick={() => setForm(saved)} type="button" variant="outline">
              Discard changes
            </Button>
            <Button
              loading={saving}
              onClick={() => {
                const defaultLanguageId =
                  languages.find((language) => language.code === form.language)?.id ?? "";
                setSaving(true);
                void onSave({ ...form, defaultLanguageId })
                  .then(() => {
                    setSaved(form);
                    toast.success("General settings saved");
                  })
                  .catch((reason: unknown) =>
                    toast.error(
                      reason instanceof Error ? reason.message : "Could not save general settings.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
              type="button"
            >
              Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
