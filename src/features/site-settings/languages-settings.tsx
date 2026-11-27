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
import { NativeSelect } from "@/components/ui/native-select";

import { type SiteLanguage } from "./site-settings-model";
import { SectionHeading, SettingsCard } from "./settings-layout";

const availableLanguages = {
  fr: { code: "FR", name: "French" },
  es: { code: "ES", name: "Spanish" },
  it: { code: "IT", name: "Italian" },
} as const;

export function LanguagesSettings({
  languages,
  readOnly,
  onAdd,
  onRemove,
  onSetDefault,
}: {
  languages: SiteLanguage[];
  readOnly: boolean;
  onAdd: (language: {
    code: string;
    name: string;
    urlPrefix: string;
    position: number;
  }) => Promise<void>;
  onRemove: (languageId: string) => Promise<void>;
  onSetDefault: (languageId: string) => Promise<void>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [language, setLanguage] = useState<keyof typeof availableLanguages>("fr");
  const [saving, setSaving] = useState(false);

  function addLanguage() {
    const option = availableLanguages[language];
    setSaving(true);
    void onAdd({
      code: option.code,
      name: option.name,
      urlPrefix: option.code.toLowerCase(),
      position: languages.length,
    })
      .then(() => {
        setAddOpen(false);
        toast.success("Language added", { description: option.name });
      })
      .catch((reason: unknown) =>
        toast.error(reason instanceof Error ? reason.message : "Could not add the language."),
      )
      .finally(() => setSaving(false));
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionHeading
        action={
          !readOnly ? (
            <Button onClick={() => setAddOpen(true)} type="button">
              <i aria-hidden className="ph-bold ph-plus" /> Add language
            </Button>
          ) : undefined
        }
        description="Each language is an independent page tree with its own URLs."
        title="Languages"
      />
      <SettingsCard
        description="Manage languages, URL prefixes, and the default language."
        icon="ph-translate"
        title="Website languages"
      >
        <div className="divide-y divide-border">
          {languages.map((item) => (
            <article
              className="flex items-center gap-4 py-3 first:pt-0 last:pb-0 max-[620px]:flex-wrap"
              key={item.code}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-selection font-mono text-[11px] font-bold text-action">
                {item.code}
              </span>
              <div className="min-w-[180px] flex-1">
                <strong className="text-[13px]">{item.name}</strong>
                {item.default ? (
                  <span className="ml-2 rounded-md bg-clay-soft px-1.5 py-0.5 text-[9.5px] font-semibold text-clay-dark">
                    Default
                  </span>
                ) : null}
                <small className="mt-0.5 block font-mono text-[10.5px] text-ink-subtle">
                  {item.url}
                </small>
              </div>
              <span className="text-[11px] text-ink-muted">{item.pages} pages</span>
              {!readOnly && !item.default ? (
                <div className="flex gap-1">
                  <Button
                    aria-label={`Set ${item.name} as default`}
                    onClick={() => {
                      if (!item.id) return;
                      void onSetDefault(item.id)
                        .then(() =>
                          toast.success("Default language updated", { description: item.name }),
                        )
                        .catch((reason: unknown) =>
                          toast.error(
                            reason instanceof Error
                              ? reason.message
                              : "Could not update the default language.",
                          ),
                        );
                    }}
                    size="icon-xs"
                    title="Set as default"
                    type="button"
                    variant="ghost"
                  >
                    <i aria-hidden className="ph ph-star" />
                  </Button>
                  <Button
                    aria-label={`Remove ${item.name}`}
                    disabled={item.pages > 0}
                    onClick={() => {
                      if (!item.id) return;
                      void onRemove(item.id).catch((reason: unknown) =>
                        toast.error(
                          reason instanceof Error
                            ? reason.message
                            : "Could not remove the language.",
                        ),
                      );
                    }}
                    size="icon-xs"
                    title={
                      item.pages > 0
                        ? "Languages with content cannot be removed here"
                        : "Remove language"
                    }
                    type="button"
                    variant="ghost"
                  >
                    <i aria-hidden className="ph ph-trash" />
                  </Button>
                </div>
              ) : (
                <span className="w-7" />
              )}
            </article>
          ))}
        </div>
      </SettingsCard>
      <div className="mt-4 rounded-card border border-border bg-surface p-4">
        <div className="flex items-start gap-2.5 text-[11.5px] text-ink-muted">
          <i aria-hidden className="ph ph-info mt-0.5 text-action" />
          <p className="m-0">
            <strong className="text-ink">Adding a language does not translate content.</strong>
            <br />
            It creates a new independent page tree. Translation relationships can be added later.
          </p>
        </div>
      </div>
      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent>
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Add language</DialogTitle>
            <DialogDescription className="text-[12px] text-ink-muted">
              Create an independent language tree for this website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <label
              className="block text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase"
              htmlFor="new-site-language"
            >
              Language
              <div className="relative mt-1.5">
                <NativeSelect
                  id="new-site-language"
                  onChange={(event) =>
                    setLanguage(event.target.value as keyof typeof availableLanguages)
                  }
                  value={language}
                >
                  {Object.entries(availableLanguages).map(([code, option]) => (
                    <option key={code} value={code}>
                      {option.name} · {option.code}
                    </option>
                  ))}
                </NativeSelect>
                <i
                  aria-hidden
                  className="ph ph-caret-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs"
                />
              </div>
            </label>
            <div className="rounded-lg bg-sunken p-3 text-[11.5px] text-ink-muted">
              <strong className="text-ink">URL preview</strong>
              <div className="mt-1 font-mono">
                northstar.example/{availableLanguages[language].code.toLowerCase()}/about
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button loading={saving} onClick={addLanguage} type="button">
              Add language
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
