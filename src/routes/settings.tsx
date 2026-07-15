import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import "../settings.css";

export const Route = createFileRoute("/settings")({
  component: SiteSettings,
});

function SiteSettings() {
  return (
    <AppShell active="settings">
      <section className="sf-site-settings">
        <header>
          <div>
            <span className="sf-site-settings-eyebrow">
              <i className="ph ph-gear" /> Website configuration
            </span>
            <h1>Site settings</h1>
            <p>Manage settings that apply to this website.</p>
          </div>
        </header>

        <div className="sf-site-settings-placeholder">
          <span>
            <i className="ph ph-gear-six" />
          </span>
          <h2>Site-wide settings</h2>
          <p>
            This area is separate from page templates and personal settings. Its fields will be
            implemented when the site settings design and requirements are ready.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
