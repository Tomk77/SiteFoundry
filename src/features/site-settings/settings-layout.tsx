import type { ReactNode } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { destinations, type SettingsDestination, type ViewerRole } from "./site-settings-model";

export function SettingsHeader({
  viewerRole,
  siteName,
}: {
  viewerRole: ViewerRole;
  siteName: string;
}) {
  const readOnly = viewerRole !== "owner" && viewerRole !== "administrator";

  return (
    <header className="flex min-h-[116px] items-start justify-between gap-4 border-b border-border px-7 py-5 max-[760px]:px-4">
      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.08em] text-action uppercase">
          <i aria-hidden className="ph ph-gear" /> Website configuration
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-[27px] tracking-[-0.025em] text-ink">Site settings</h1>
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-semibold",
              readOnly ? "bg-sunken text-ink-muted" : "bg-clay-soft text-clay-dark",
            )}
          >
            <i aria-hidden className={readOnly ? "ph ph-eye" : "ph-fill ph-crown"} />
            {readOnly ? "Read only" : viewerRole === "owner" ? "Owner" : "Administrator"}
          </span>
        </div>
        <p className="mt-1.5 mb-0 text-[13px] text-ink-muted">Settings for {siteName}.</p>
      </div>
    </header>
  );
}

export function SettingsNavigation({
  destination,
  invitationCount,
  onChange,
}: {
  destination: SettingsDestination;
  invitationCount: number;
  onChange: (destination: SettingsDestination) => void;
}) {
  return (
    <>
      <nav
        aria-label="Site settings"
        className="bg-rail w-[218px] shrink-0 border-r border-border p-3 max-[760px]:hidden"
      >
        {destinations.map((item) => (
          <button
            aria-current={destination === item.id ? "page" : undefined}
            aria-label={item.label}
            className={cn(
              "mb-1 flex h-9 w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left text-[12.5px] font-medium text-ink hover:bg-selection-surface",
              destination === item.id && "bg-selection font-semibold text-action",
            )}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <i aria-hidden className={`ph ${item.icon} text-[15px]`} />
            <span>{item.label}</span>
            {item.id === "people" && invitationCount > 0 ? (
              <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-concept-soft px-1.5 py-0.5 font-mono text-[10px] text-concept">
                {invitationCount}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="bg-rail hidden border-b border-border p-3 max-[760px]:block">
        <label className="sr-only" htmlFor="settings-destination">
          Settings destination
        </label>
        <div className="relative">
          <NativeSelect
            id="settings-destination"
            onChange={(event) => onChange(event.target.value as SettingsDestination)}
            value={destination}
          >
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.id === "people" && invitationCount ? ` (${invitationCount})` : ""}
              </option>
            ))}
          </NativeSelect>
          <i
            aria-hidden
            className="ph ph-caret-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-muted"
          />
        </div>
      </div>
    </>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4 max-[620px]:flex-col">
      <div>
        <h2 className="m-0 text-xl tracking-[-0.015em] text-ink">{title}</h2>
        <p className="mt-1.5 mb-0 max-w-[660px] text-[12.5px] leading-5 text-ink-muted">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

export function SettingsCard({
  title,
  description,
  icon,
  children,
  danger = false,
}: {
  title: string;
  description: string;
  icon: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-panel border bg-surface",
        danger ? "border-danger/40" : "border-border",
      )}
    >
      <header className="flex min-h-16 items-center gap-3 border-b border-border px-5 py-3.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg text-[15px]",
            danger ? "bg-danger-soft text-danger" : "bg-selection text-action",
          )}
        >
          <i aria-hidden className={`ph ${icon}`} />
        </span>
        <div>
          <h3 className="m-0 text-[14px] font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 mb-0 text-[11.5px] leading-4 text-ink-subtle">{description}</p>
        </div>
      </header>
      <div className="p-5 max-[620px]:p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
      <span>{label}</span>
      {children}
      {hint ? (
        <small className="text-[11px] leading-4 font-normal tracking-normal text-ink-subtle normal-case">
          {hint}
        </small>
      ) : null}
    </label>
  );
}
