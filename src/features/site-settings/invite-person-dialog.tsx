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
import { cn } from "@/lib/utils";

import {
  sections,
  type AccessScope,
  type InvitationDraft,
  type MemberRole,
} from "./site-settings-model";

type InviteRole = Exclude<MemberRole, "Owner">;

const roles: Array<{ name: InviteRole; description: string }> = [
  { name: "Administrator", description: "Manage this website, its settings, and its people." },
  { name: "Publisher", description: "Create, edit, and publish content in the assigned scope." },
  { name: "Editor", description: "Create and edit content without publishing." },
  { name: "Viewer", description: "View content and configuration without making changes." },
];

export function InvitePersonDialog({
  open,
  languages,
  branches,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  languages: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string; language: string }>;
  onOpenChange: (open: boolean) => void;
  onSend: (invitation: InvitationDraft) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("Editor");
  const [scope, setScope] = useState<AccessScope>("full");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([languages[0]?.id ?? ""]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>(["pages", "media"]);
  const [attempted, setAttempted] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const scopeDescription =
    scope === "full"
      ? "the full site"
      : scope === "languages"
        ? selectedLanguages
            .map((id) => languages.find((language) => language.id === id)?.name)
            .filter(Boolean)
            .join(" and ") || "no languages"
        : selectedBranches
            .map((id) => branches.find((branch) => branch.id === id)?.name)
            .filter(Boolean)
            .join(", ") || "no branches";
  const sectionDescription = selectedSections
    .map((id) => sections.find((section) => section.id === id)?.name)
    .filter(Boolean)
    .join(" and ");

  function reset() {
    setEmail("");
    setRole("Editor");
    setScope("full");
    setSelectedLanguages([languages[0]?.id ?? ""]);
    setSelectedBranches([]);
    setSelectedSections(["pages", "media"]);
    setAttempted(false);
    setSent(false);
  }

  async function submit() {
    setAttempted(true);
    if (!valid) return;

    setSending(true);
    try {
      await onSend({
        email: email.trim(),
        role,
        accessScope: scope,
        languageIds: selectedLanguages.filter(Boolean),
        branchIds: selectedBranches,
        sections: selectedSections,
      });
      setSent(true);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not send the invitation.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[92vh] w-[min(580px,calc(100vw-32px))] flex-col max-[620px]:h-dvh max-[620px]:max-h-none max-[620px]:w-screen max-[620px]:rounded-none">
        {sent ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-published-soft text-2xl text-published">
              <i aria-hidden className="ph-fill ph-check-circle" />
            </span>
            <DialogTitle className="mt-4 text-lg">Invitation sent</DialogTitle>
            <DialogDescription className="mt-2 max-w-[360px] text-[12.5px] leading-5 text-ink-muted">
              {email} was invited as {role} with access to {scopeDescription}.
            </DialogDescription>
            <div className="mt-6 flex gap-2">
              <Button onClick={reset} type="button" variant="outline">
                Invite another
              </Button>
              <DialogClose render={<Button type="button" />}>Done</DialogClose>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-border px-5 py-4 pr-12">
              <DialogTitle>Invite person</DialogTitle>
              <DialogDescription className="text-[12px] text-ink-muted">
                Choose what this person can do and where their access applies.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <label className="block text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
                Email address
                <Input
                  aria-invalid={attempted && !valid}
                  autoFocus
                  className="mt-1.5 tracking-normal normal-case"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                />
                {attempted && !valid ? (
                  <span className="mt-1 block text-[11px] font-normal tracking-normal text-danger normal-case">
                    Enter a valid email address.
                  </span>
                ) : null}
              </label>
              <ChoiceGroup label="Role preset">
                <div className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
                  {roles.map((option) => (
                    <button
                      aria-pressed={role === option.name}
                      className={cn(
                        "hover:bg-rail rounded-card border border-border bg-surface p-3 text-left",
                        role === option.name &&
                          "border-action bg-selection-surface ring-1 ring-action",
                      )}
                      key={option.name}
                      onClick={() => setRole(option.name)}
                      type="button"
                    >
                      <strong className="block text-[12.5px]">{option.name}</strong>
                      <small className="mt-1 block text-[10.5px] leading-4 text-ink-subtle">
                        {option.description}
                      </small>
                    </button>
                  ))}
                </div>
              </ChoiceGroup>
              <ChoiceGroup label="Access scope">
                <div className="grid grid-cols-3 gap-2 max-[560px]:grid-cols-1">
                  {(
                    [
                      { id: "full", label: "Full site" },
                      { id: "languages", label: "Selected languages" },
                      { id: "branches", label: "Selected branches" },
                    ] as const
                  ).map((option) => (
                    <ChoiceButton
                      key={option.id}
                      active={scope === option.id}
                      label={option.label}
                      onClick={() => setScope(option.id)}
                    />
                  ))}
                </div>
              </ChoiceGroup>
              {scope === "languages" ? (
                <ChoiceGroup label="Languages">
                  <div className="flex flex-wrap gap-2">
                    {languages.map((language) => (
                      <ToggleChip
                        active={selectedLanguages.includes(language.id)}
                        icon="ph-translate"
                        key={language.id}
                        label={language.name}
                        onClick={() => setSelectedLanguages(toggle(selectedLanguages, language.id))}
                      />
                    ))}
                  </div>
                </ChoiceGroup>
              ) : null}
              {scope === "branches" ? (
                <ChoiceGroup label="Page branches">
                  <div className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
                    {branches.map((branch) => (
                      <ToggleChip
                        active={selectedBranches.includes(branch.id)}
                        icon="ph-tree-structure"
                        key={branch.id}
                        label={`${branch.name} · ${branch.language}`}
                        onClick={() => setSelectedBranches(toggle(selectedBranches, branch.id))}
                      />
                    ))}
                  </div>
                </ChoiceGroup>
              ) : null}
              {role !== "Administrator" ? (
                <ChoiceGroup label="Product sections">
                  <div className="flex flex-wrap gap-2">
                    {sections.map((section) => (
                      <ToggleChip
                        active={selectedSections.includes(section.id)}
                        icon={section.icon}
                        key={section.id}
                        label={section.name}
                        onClick={() => setSelectedSections(toggle(selectedSections, section.id))}
                      />
                    ))}
                  </div>
                </ChoiceGroup>
              ) : null}
              <details className="rounded-lg border border-border px-3 py-2.5 text-[12px]">
                <summary className="cursor-pointer font-medium text-ink-muted">
                  Add a personal message
                </summary>
                <textarea
                  className="mt-3 min-h-20 w-full resize-y rounded-lg border border-field bg-surface p-2.5 text-[12px] outline-none focus:border-action focus:ring-3 focus:ring-focus-ring"
                  placeholder="Optional message"
                />
              </details>
              <div className="rounded-card bg-selection-surface p-3 text-[11.5px] leading-5 text-ink-muted">
                <strong className="text-ink">Access summary</strong>
                <p className="mt-1 mb-0">
                  {email.trim() || "This person"} will be able to{" "}
                  {role === "Administrator"
                    ? "manage this website"
                    : role === "Publisher"
                      ? `edit and publish ${sectionDescription}`
                      : role === "Editor"
                        ? `edit ${sectionDescription} without publishing`
                        : `view ${sectionDescription}`}{" "}
                  in {scopeDescription}.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={!valid}
                loading={sending}
                onClick={() => void submit()}
                type="button"
              >
                <i aria-hidden className="ph-bold ph-paper-plane-tilt" /> Send invitation
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-9 rounded-lg border border-border bg-surface px-3 text-[11.5px] font-medium",
        active && "border-action bg-selection-surface text-action ring-1 ring-action",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ToggleChip({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11px] font-medium",
        active && "border-action bg-selection-surface text-action",
      )}
      onClick={onClick}
      type="button"
    >
      <i aria-hidden className={`ph ${active ? "ph-check-circle" : icon}`} />
      {label}
    </button>
  );
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
