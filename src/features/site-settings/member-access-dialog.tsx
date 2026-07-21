import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { initials, sections, type Member, type MemberRole } from "./site-settings-model";

export function MemberAccessDialog({
  member,
  readOnly,
  languages,
  branches,
  onClose,
  onSave,
}: {
  member: Member | null;
  readOnly: boolean;
  languages: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string; language: string }>;
  onClose: () => void;
  onSave: (member: Member) => void;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(member)}>
      {member ? (
        <MemberAccessForm
          branches={branches}
          key={member.id}
          languages={languages}
          member={member}
          onSave={onSave}
          readOnly={readOnly}
        />
      ) : null}
    </Dialog>
  );
}

function MemberAccessForm({
  member,
  readOnly,
  languages,
  branches,
  onSave,
}: {
  member: Member;
  readOnly: boolean;
  languages: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string; language: string }>;
  onSave: (member: Member) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [scope, setScope] = useState(member.scope);
  const [selectedLanguages, setSelectedLanguages] = useState(member.languages);
  const [selectedBranches, setSelectedBranches] = useState(member.branches);
  const [selectedSections, setSelectedSections] = useState(member.sections);
  const owner = member.role === "Owner";
  const locked = readOnly || owner;
  const roles: MemberRole[] = ["Administrator", "Publisher", "Editor", "Viewer"];
  const scopeText =
    scope === "full"
      ? "Full site"
      : scope === "languages"
        ? selectedLanguages
            .map((id) => languages.find((language) => language.id === id)?.name ?? id)
            .join(", ")
        : selectedBranches
            .map((id) => branches.find((branch) => branch.id === id)?.name ?? id)
            .join(", ");
  const sectionText = selectedSections
    .map((id) => sections.find((section) => section.id === id)?.name ?? id)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  return (
    <DialogContent className="!top-0 !right-0 !left-auto flex !h-dvh !max-h-none !w-[min(480px,100vw)] !translate-x-0 !translate-y-0 flex-col !rounded-none">
      <header className="border-b border-border p-5 pr-12">
        <DialogTitle>{readOnly ? "View access" : "Change role & access"}</DialogTitle>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-clay-soft text-sm font-bold text-clay-dark">
            {initials(member.name)}
          </span>
          <span>
            <strong className="block text-[13px]">{member.name}</strong>
            <small className="text-[11px] text-ink-subtle">
              {member.email} · Active {member.lastActive}
            </small>
          </span>
        </div>
        {owner ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-clay-soft p-2.5 text-[11.5px] text-clay-dark">
            <i aria-hidden className="ph-fill ph-crown mt-0.5" />
            Ownership is managed separately in Advanced settings.
          </div>
        ) : null}
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <AccessGroup label="Role preset">
          <div className="grid grid-cols-2 gap-2">
            {roles.map((option) => (
              <OptionButton
                active={role === option}
                disabled={locked}
                key={option}
                label={option}
                onClick={() => setRole(option)}
              />
            ))}
          </div>
        </AccessGroup>
        <AccessGroup label="Access scope">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "full", label: "Full site" },
                { id: "languages", label: "Languages" },
                { id: "branches", label: "Branches" },
              ] as const
            ).map((option) => (
              <OptionButton
                active={scope === option.id}
                disabled={locked}
                key={option.id}
                label={option.label}
                onClick={() => setScope(option.id)}
              />
            ))}
          </div>
        </AccessGroup>
        {scope === "languages" ? (
          <AccessGroup label="Languages">
            <div className="flex flex-wrap gap-2">
              {languages.map((language) => (
                <Toggle
                  active={selectedLanguages.includes(language.id)}
                  disabled={locked}
                  key={language.id}
                  label={language.name}
                  onClick={() => setSelectedLanguages(toggle(selectedLanguages, language.id))}
                />
              ))}
            </div>
          </AccessGroup>
        ) : null}
        {scope === "branches" ? (
          <AccessGroup label="Page branches">
            <div className="grid grid-cols-2 gap-2">
              {branches.map((branch) => (
                <Toggle
                  active={selectedBranches.includes(branch.id)}
                  disabled={locked}
                  key={branch.id}
                  label={`${branch.name} · ${branch.language}`}
                  onClick={() => setSelectedBranches(toggle(selectedBranches, branch.id))}
                />
              ))}
            </div>
          </AccessGroup>
        ) : null}
        {role !== "Administrator" && role !== "Owner" ? (
          <AccessGroup label="Product sections">
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <Toggle
                  active={selectedSections.includes(section.id)}
                  disabled={locked}
                  key={section.id}
                  label={section.name}
                  onClick={() => setSelectedSections(toggle(selectedSections, section.id))}
                />
              ))}
            </div>
          </AccessGroup>
        ) : null}
      </div>
      <div className="border-t border-border bg-surface p-4">
        <div className="mb-3 rounded-lg bg-selection-surface px-3 py-2.5 text-[11px] text-ink-muted">
          <strong className="text-ink">{role}</strong> · {scopeText || "No access selected"}
          {sectionText ? ` · ${sectionText}` : ""}
        </div>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button type="button" variant="outline" />}>
            {readOnly ? "Close" : "Cancel"}
          </DialogClose>
          {!readOnly && !owner ? (
            <Button
              onClick={() =>
                onSave({
                  ...member,
                  role,
                  scope,
                  languages: selectedLanguages,
                  branches: selectedBranches,
                  sections: selectedSections,
                })
              }
              type="button"
            >
              Save access
            </Button>
          ) : null}
        </div>
      </div>
    </DialogContent>
  );
}

function AccessGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function OptionButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "min-h-9 rounded-lg border border-border bg-surface px-2.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50",
        active && "border-action bg-selection-surface text-action ring-1 ring-action",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Toggle({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50",
        active && "border-action bg-selection-surface text-action",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <i aria-hidden className={active ? "ph ph-check-circle" : "ph ph-circle"} />
      {label}
    </button>
  );
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
