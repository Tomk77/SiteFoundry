import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";

export const Route = createFileRoute("/settings")({
  component: SiteSettings,
});

function SiteSettings() {
  return (
    <AppShell active="settings">
      <section className="min-h-full bg-canvas px-[38px] py-8 max-[900px]:p-6">
        <header className="flex min-h-28 items-start border-b border-border">
          <div>
            <span className="mb-2 flex items-center gap-[7px] text-[10.5px] font-bold tracking-[0.08em] text-action uppercase">
              <i className="ph ph-gear" /> Website configuration
            </span>
            <h1 className="m-0 text-[28px] tracking-[-0.025em] text-ink">Site settings</h1>
            <p className="mt-1.5 mb-0 text-[13px] text-ink-muted">
              Manage settings that apply to this website.
            </p>
          </div>
        </header>

        <div className="mt-6 flex min-h-[260px] max-w-[620px] flex-col items-center justify-center rounded-panel border border-border bg-surface p-[42px] text-center">
          <span className="mb-3.5 grid size-[42px] place-items-center rounded-card bg-selection text-[21px] text-action">
            <i className="ph ph-gear-six" />
          </span>
          <h2 className="mt-0 mb-[7px] text-base text-ink">Site-wide settings</h2>
          <p className="m-0 max-w-[450px] text-[12.5px] leading-[1.6] text-ink-muted">
            This area is separate from page templates and personal settings. Its fields will be
            implemented when the site settings design and requirements are ready.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
