import { Button } from "@/components/ui/button";
import { LoadingSplash, RouteLoading } from "@/components/loading";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  applyInterfaceMode,
  changePassword,
  interfaceLanguages,
  loadPersonalSettings,
  savePersonalSettings,
  usesPasswordAuthentication,
  type PersonalSettings as PersonalSettingsValue,
} from "@/lib/personal-settings";

const emptySettings: PersonalSettingsValue = {
  firstName: "",
  lastName: "",
  email: "",
  displayName: "",
  interfaceLanguage: "en",
  interfaceMode: "system",
};

export function PersonalSettingsScreen() {
  const navigate = useNavigate({ from: "/personal-settings" });
  const { user, loading: authLoading } = useAuth();
  const [settingsUser, setSettingsUser] = useState(() => user);
  const [saved, setSaved] = useState(emptySettings);
  const [form, setForm] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user && user.id !== settingsUser?.id) setSettingsUser(user);
  }, [settingsUser?.id, user]);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const valid = Boolean(form.firstName.trim() && form.displayName.trim() && emailValid);
  const passwordValid = Boolean(
    password.current && password.next.length >= 10 && password.next === password.confirm,
  );
  const hasPassword = user ? usesPasswordAuthentication(user) : false;
  const displayName =
    form.displayName || [form.firstName, form.lastName].filter(Boolean).join(" ") || "Editor";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!settingsUser) return;
    setLoading(true);
    void loadPersonalSettings(settingsUser)
      .then((settings) => {
        setSaved(settings);
        setForm(settings);
        applyInterfaceMode(settings.interfaceMode);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Could not load personal settings."),
      )
      .finally(() => setLoading(false));
  }, [settingsUser]);

  useEffect(() => {
    if (loading) return;
    applyInterfaceMode(form.interfaceMode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => form.interfaceMode === "system" && applyInterfaceMode("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [form.interfaceMode, loading]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const update = <K extends keyof PersonalSettingsValue>(
    key: K,
    value: PersonalSettingsValue[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  };

  const save = async () => {
    if (!user || !dirty || !valid || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await savePersonalSettings(user, form);
      setSaved(form);
      if (result.emailConfirmationPending)
        setNotice(
          "Check your new email address and follow the confirmation link to finish the change.",
        );
      showToast("Personal settings saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save personal settings.");
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    if (!user?.email || !passwordValid || passwordSaving) return;
    setPasswordSaving(true);
    setPasswordError("");
    try {
      await changePassword({
        email: user.email,
        currentPassword: password.current,
        newPassword: password.next,
      });
      setPassword({ current: "", next: "", confirm: "" });
      showToast("Password updated");
    } catch (reason) {
      setPasswordError(reason instanceof Error ? reason.message : "Could not update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const leave = () => {
    if (dirty && !window.confirm("Discard your unsaved personal settings?")) return;
    applyInterfaceMode(saved.interfaceMode);
    void navigate({ to: "/" });
  };

  if (authLoading) return <LoadingSplash />;
  if (loading) return <PersonalSettingsLoading />;
  if (!user)
    return (
      <div className="sf-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
        Redirecting to sign in...
      </div>
    );

  return (
    <main className="sf-personal-settings [display:flex] [height:100vh] [width:100vw] [animation:sf-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-canvas text-ink [transition:background_160ms_ease,_color_160ms_ease] motion-reduce:[animation:none] motion-reduce:[transition:none]">
      <header className="sf-personal-top [display:flex] [min-height:58px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_20px] [border-bottom:1px_solid_var(--sf-border)] [&>button:first-child]:[display:inline-flex] [&>button:first-child]:[height:34px] [&>button:first-child]:[cursor:pointer] [&>button:first-child]:[align-items:center] [&>button:first-child]:[gap:7px] [&>button:first-child]:[border-radius:8px] [&>button:first-child]:[padding:0_11px] [&>button:first-child]:[font-size:13px] [&>button:first-child]:[font-weight:600] [&>button:first-child]:text-ink-muted [&>button:first-child]:[background:transparent] [&>button:first-child]:[border:1px_solid_var(--sf-field)] [&>div]:[display:flex] [&>div]:[flex-direction:column] [&>div_small]:[font-size:11.5px] [&>div_small]:text-ink-subtle max-[720px]:[&>div_small]:[display:none] [&>div_strong]:[font-size:14px]">
        <Button unstyled onClick={leave} type="button">
          <i className="ph-bold ph-arrow-left" /> Back to app
        </Button>
        <span className="sf-personal-mark [display:grid] [height:34px] [width:34px] [place-items:center] [border-radius:9px] bg-selection text-action">
          <i className="ph-bold ph-hammer" />
        </span>
        <div>
          <strong>Personal settings</strong>
          <small>Applies to your account across every website</small>
        </div>
        <span className="sf-spacer [flex:1]" />
        <span className="sf-personal-saved [font-size:12px] text-ink-subtle max-[720px]:[display:none]">
          {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {dirty ? (
          <Button
            unstyled
            className="sf-personal-discard [height:34px] [cursor:pointer] [border-radius:8px] [padding:0_14px] [font-size:13px] [font-weight:600] text-ink-muted [background:transparent] [border:1px_solid_var(--sf-field)]"
            onClick={() => {
              setForm(saved);
              applyInterfaceMode(saved.interfaceMode);
            }}
            type="button"
          >
            Discard
          </Button>
        ) : null}
        <Button
          unstyled
          className="sf-personal-save [height:34px] [cursor:pointer] [border-radius:8px] bg-action [padding:0_14px] [font-size:13px] [font-weight:600] [color:var(--sf-on-accent)] [border:0] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] [&:hover:not(:disabled)]:bg-action-hover"
          disabled={!dirty || !valid || saving}
          loading={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </header>

      <div className="sf-personal-scroll sf-scroll [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
        <div className="sf-personal-content [margin:26px_auto_60px] [display:flex] [width:min(680px,_calc(100%_-_40px))] [flex-direction:column] [gap:18px] max-[720px]:[margin-top:12px] max-[720px]:[width:min(100%_-_24px,_680px)]">
          <section className="sf-account-summary [display:flex] [min-height:90px] [align-items:center] [gap:14px] [border-radius:12px] bg-surface [padding:18px_20px] [border:1px_solid_var(--sf-border)] [&>b]:[border-radius:999px] [&>b]:bg-sunken [&>b]:[padding:6px_12px] [&>b]:[font-size:11px] [&>b]:[font-weight:600] [&>b]:text-ink-muted [&>div]:[display:flex] [&>div]:[flex-direction:column] [&>div]:[gap:3px] [&>div_small]:text-ink-subtle [&>div_small]:[font:12px_'Geist_Mono',_monospace] [&>div_strong]:[font-size:16px]">
            <span className="sf-personal-avatar [display:grid] [height:50px] [width:50px] [flex:none] [place-items:center] [border-radius:50%] bg-selection [font-size:18px] [font-weight:700] text-action">
              {initials}
            </span>
            <div>
              <strong>{displayName}</strong>
              <small>{form.email}</small>
            </div>
            <span className="sf-spacer [flex:1]" />
            <b>Account-wide</b>
          </section>

          <SettingsSection
            icon="ph-user"
            title="Profile"
            description="Your name and sign-in identity"
          >
            <div className="sf-profile-grid [display:grid] [grid-template-columns:1fr_1fr] [gap:16px_14px] max-[720px]:[grid-template-columns:1fr]">
              <SettingField label="First name" required dirty={form.firstName !== saved.firstName}>
                <Input
                  unstyled
                  aria-invalid={!form.firstName.trim()}
                  value={form.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                />
                {!form.firstName.trim() ? (
                  <small className="error">First name is required.</small>
                ) : null}
              </SettingField>
              <SettingField label="Last name" dirty={form.lastName !== saved.lastName}>
                <Input
                  unstyled
                  value={form.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                />
              </SettingField>
              <SettingField
                className="wide"
                label="Email"
                required
                dirty={form.email !== saved.email}
              >
                <Input
                  unstyled
                  aria-invalid={!emailValid}
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                />
                {!emailValid ? <small className="error">Enter a valid email address.</small> : null}
                {form.email !== saved.email && emailValid ? (
                  <small>
                    Email changes require confirmation from a link sent to the new address.
                  </small>
                ) : null}
              </SettingField>
              <SettingField
                className="wide"
                label="Display name"
                dirty={form.displayName !== saved.displayName}
              >
                <Input
                  unstyled
                  value={form.displayName}
                  onChange={(event) => update("displayName", event.target.value)}
                />
                <small>
                  Shown on your user card and in activity logs. Not your public author name.
                </small>
              </SettingField>
            </div>
          </SettingsSection>

          <SettingsSection
            icon="ph-lock-key"
            title="Change password"
            description="Update the password you use to sign in"
          >
            {hasPassword ? (
              <div className="sf-password-grid [display:grid] [grid-template-columns:1fr_1fr] [gap:16px_14px] max-[720px]:[grid-template-columns:1fr] [&>.wide]:[grid-column:1_/_-1] max-[720px]:[&>.wide]:[grid-column:auto]">
                <PasswordField
                  className="wide"
                  label="Current password"
                  name="current"
                  value={password.current}
                  visible={showPassword.current}
                  onChange={(value) => setPassword((current) => ({ ...current, current: value }))}
                  onToggle={() =>
                    setShowPassword((current) => ({
                      ...current,
                      current: !current.current,
                    }))
                  }
                />
                <PasswordField
                  label="New password"
                  name="next"
                  value={password.next}
                  visible={showPassword.next}
                  onChange={(value) => setPassword((current) => ({ ...current, next: value }))}
                  onToggle={() =>
                    setShowPassword((current) => ({
                      ...current,
                      next: !current.next,
                    }))
                  }
                />
                <PasswordField
                  label="Confirm new password"
                  name="confirm"
                  value={password.confirm}
                  visible={showPassword.confirm}
                  onChange={(value) => setPassword((current) => ({ ...current, confirm: value }))}
                  onToggle={() =>
                    setShowPassword((current) => ({
                      ...current,
                      confirm: !current.confirm,
                    }))
                  }
                />
                <div className="sf-password-policy [grid-column:1_/_-1] [display:flex] [align-items:center] [gap:14px] max-[720px]:[grid-column:auto] max-[720px]:[flex-wrap:wrap] [&_button]:[height:34px] [&_button]:[cursor:pointer] [&_button]:[border-radius:7px] [&_button]:bg-action [&_button]:[padding:0_12px] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:[color:var(--sf-on-accent)] [&_button]:[border:0] [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.45] [&>span.error]:text-danger [&>span.valid]:text-published [&>span:not(.sf-spacer)]:[display:inline-flex] [&>span:not(.sf-spacer)]:[align-items:center] [&>span:not(.sf-spacer)]:[gap:5px] [&>span:not(.sf-spacer)]:[font-size:11.5px] [&>span:not(.sf-spacer)]:text-ink-subtle">
                  <span className={password.next.length >= 10 ? "valid" : ""}>
                    <i
                      className={`ph-fill ${password.next.length >= 10 ? "ph-check-circle" : "ph-circle"}`}
                    />{" "}
                    At least 10 characters
                  </span>
                  {password.confirm ? (
                    <span className={password.next === password.confirm ? "valid" : "error"}>
                      <i
                        className={`ph-fill ${password.next === password.confirm ? "ph-check-circle" : "ph-warning-circle"}`}
                      />{" "}
                      {password.next === password.confirm
                        ? "Passwords match"
                        : "Passwords do not match"}
                    </span>
                  ) : null}
                  <span className="sf-spacer [flex:1]" />
                  <Button
                    unstyled
                    disabled={!passwordValid || passwordSaving}
                    loading={passwordSaving}
                    onClick={() => void updatePassword()}
                    type="button"
                  >
                    {passwordSaving ? "Updating..." : "Update password"}
                  </Button>
                </div>
                {passwordError ? (
                  <p className="sf-personal-error wide [display:flex] [align-items:flex-start] [gap:8px] [border-radius:9px] [padding:12px_14px] [font-size:12.5px] [line-height:1.45] text-danger [background:color-mix(in_srgb,_var(--sf-danger)_10%,_var(--sf-surface))] [border:1px_solid_color-mix(in_srgb,_var(--sf-danger)_30%,_transparent)] [&.wide]:[grid-column:1_/_-1] [&.wide]:[margin:0]">
                    {passwordError}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="sf-provider-guidance [display:flex] [align-items:flex-start] [gap:13px] [border-radius:9px] bg-sunken [padding:14px] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:[line-height:1.5] [&_p]:text-ink-muted [&_strong]:[font-size:13px] [&>div]:[display:flex] [&>div]:[flex-direction:column] [&>div]:[gap:4px] [&>span]:[display:grid] [&>span]:[height:34px] [&>span]:[width:34px] [&>span]:[flex:none] [&>span]:[place-items:center] [&>span]:[border-radius:8px] [&>span]:bg-surface [&>span]:[font-size:18px] [&>span]:text-ink">
                <span>
                  <i className="ph-fill ph-google-logo" />
                </span>
                <div>
                  <strong>Password managed by Google</strong>
                  <p>
                    You signed in with Google, so there is no SiteFoundry password to change. Manage
                    your sign-in security in your Google account.
                  </p>
                </div>
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            icon="ph-sliders-horizontal"
            title="Experience"
            description="Language and appearance for your admin interface"
          >
            <div className="sf-experience-grid [display:grid] [grid-template-columns:1fr_1fr] [gap:16px_14px] max-[720px]:[grid-template-columns:1fr]">
              <SettingField
                label="Interface language"
                dirty={form.interfaceLanguage !== saved.interfaceLanguage}
              >
                <NativeSelect
                  unstyled
                  value={form.interfaceLanguage}
                  onChange={(event) => update("interfaceLanguage", event.target.value)}
                >
                  {interfaceLanguages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </NativeSelect>
                <small>
                  Changes only your SiteFoundry interface, never website content language.
                </small>
              </SettingField>
              <SettingField
                label="Interface mode"
                dirty={form.interfaceMode !== saved.interfaceMode}
              >
                <div className="sf-mode-options [display:grid] [grid-template-columns:repeat(3,_1fr)] [gap:6px] [&_button]:[display:flex] [&_button]:[height:40px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[justify-content:center] [&_button]:[gap:6px] [&_button]:[border-radius:8px] [&_button]:bg-surface [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[border:1px_solid_var(--sf-field)] [&_button.active]:border-action [&_button.active]:bg-selection [&_button.active]:text-action [&_button.active]:[box-shadow:0_0_0_2px_var(--sf-focus-ring)]">
                  {(
                    [
                      ["system", "System", "ph-desktop"],
                      ["light", "Light", "ph-sun"],
                      ["dark", "Dark", "ph-moon-stars"],
                    ] as const
                  ).map(([value, label, icon]) => (
                    <Button
                      unstyled
                      className={form.interfaceMode === value ? "active" : ""}
                      key={value}
                      onClick={() => update("interfaceMode", value)}
                      type="button"
                    >
                      <i className={`ph ${icon}`} />
                      {label}
                    </Button>
                  ))}
                </div>
                <small>“System” follows your device and switches automatically when it does.</small>
              </SettingField>
            </div>
          </SettingsSection>

          {notice ? (
            <div className="sf-personal-notice [display:flex] [align-items:flex-start] [gap:8px] [border-radius:9px] bg-selection [padding:12px_14px] [font-size:12.5px] [line-height:1.45] text-action [border:1px_solid_color-mix(in_srgb,_var(--sf-accent)_25%,_transparent)]">
              <i className="ph-fill ph-envelope-simple" />
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="sf-personal-error [display:flex] [align-items:flex-start] [gap:8px] [border-radius:9px] [padding:12px_14px] [font-size:12.5px] [line-height:1.45] text-danger [background:color-mix(in_srgb,_var(--sf-danger)_10%,_var(--sf-surface))] [border:1px_solid_color-mix(in_srgb,_var(--sf-danger)_30%,_transparent)] [&.wide]:[grid-column:1_/_-1] [&.wide]:[margin:0]">
              <i className="ph-fill ph-warning-circle" />
              {error}
            </div>
          ) : null}
        </div>
      </div>
      {toast ? (
        <div
          className="fixed bottom-[26px] left-1/2 z-[70] flex -translate-x-1/2 animate-in items-center gap-2.5 rounded-[11px] bg-ink px-4 py-3 text-[13px] text-white shadow-[0_14px_40px_rgb(23_35_38_/_32%)] duration-200 fade-in-0 slide-in-from-bottom-2 dark:border dark:border-field dark:bg-sunken dark:text-ink [&_i]:text-lg [&_i]:text-[#b994f8]"
          role="status"
        >
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function PersonalSettingsLoading() {
  return (
    <main
      aria-busy="true"
      className="sf-personal-settings [display:flex] [height:100vh] [width:100vw] [animation:sf-route-enter_140ms_ease-out] [flex-direction:column] [overflow:hidden] bg-canvas text-ink [transition:background_160ms_ease,_color_160ms_ease] motion-reduce:[animation:none] motion-reduce:[transition:none]"
    >
      <header className="sf-personal-top [display:flex] [min-height:58px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_20px] [border-bottom:1px_solid_var(--sf-border)] [&>button:first-child]:[display:inline-flex] [&>button:first-child]:[height:34px] [&>button:first-child]:[cursor:pointer] [&>button:first-child]:[align-items:center] [&>button:first-child]:[gap:7px] [&>button:first-child]:[border-radius:8px] [&>button:first-child]:[padding:0_11px] [&>button:first-child]:[font-size:13px] [&>button:first-child]:[font-weight:600] [&>button:first-child]:text-ink-muted [&>button:first-child]:[background:transparent] [&>button:first-child]:[border:1px_solid_var(--sf-field)] [&>div]:[display:flex] [&>div]:[flex-direction:column] [&>div_small]:[font-size:11.5px] [&>div_small]:text-ink-subtle max-[720px]:[&>div_small]:[display:none] [&>div_strong]:[font-size:14px]">
        <Button unstyled disabled type="button">
          <i className="ph-bold ph-arrow-left" /> Back to app
        </Button>
        <span className="sf-personal-mark [display:grid] [height:34px] [width:34px] [place-items:center] [border-radius:9px] bg-selection text-action">
          <i className="ph-bold ph-hammer" />
        </span>
        <div>
          <strong>Personal settings</strong>
          <small>Applies to your account across every website</small>
        </div>
      </header>
      <RouteLoading detail="Loading your profile and preferences." title="Loading settings" />
    </main>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="sf-settings-card [overflow:hidden] [border-radius:12px] bg-surface [border:1px_solid_var(--sf-border)] [&>header]:[display:flex] [&>header]:[min-height:64px] [&>header]:[align-items:center] [&>header]:[gap:11px] [&>header]:[padding:14px_20px] [&>header]:[border-bottom:1px_solid_var(--sf-border)] [&>header_small]:[font-size:11.5px] [&>header_small]:text-ink-subtle [&>header_strong]:[font-size:14px] [&>header>div]:[display:flex] [&>header>div]:[flex-direction:column] [&>header>span]:[display:grid] [&>header>span]:[height:30px] [&>header>span]:[width:30px] [&>header>span]:[flex:none] [&>header>span]:[place-items:center] [&>header>span]:[border-radius:8px] [&>header>span]:bg-selection [&>header>span]:text-action">
      <header>
        <span>
          <i className={`ph ${icon}`} />
        </span>
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
      </header>
      <div className="sf-settings-card-body [padding:18px_20px]">{children}</div>
    </section>
  );
}

function SettingField({
  label,
  required,
  dirty,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  dirty: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`sf-setting-field [display:flex] [min-width:0] [flex-direction:column] [gap:6px] [&_input]:[height:40px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_12px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&_input[aria-invalid='true']]:border-danger [&_select]:[height:40px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_12px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&_small]:[font-size:11.5px] [&_small]:[line-height:1.45] [&_small]:text-ink-subtle [&_small.error]:text-danger [&.wide]:[grid-column:1_/_-1] max-[720px]:[&.wide]:[grid-column:auto] [&>span]:[display:flex] [&>span]:[align-items:center] [&>span]:[gap:5px] [&>span]:[font-size:12px] [&>span]:[font-weight:600] [&>span]:text-ink-muted [&>span_b]:text-action [&>span_i]:[height:6px] [&>span_i]:[width:6px] [&>span_i]:[border-radius:999px] [&>span_i]:[background:var(--sf-warning)] ${className}`}
    >
      <span>
        {label}
        {required ? <b>*</b> : null}
        {dirty ? <i title="Unsaved change" /> : null}
      </span>
      {children}
    </label>
  );
}

function PasswordField({
  label,
  name,
  value,
  visible,
  className = "",
  onChange,
  onToggle,
}: {
  label: string;
  name: string;
  value: string;
  visible: boolean;
  className?: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label
      className={`sf-setting-field [display:flex] [min-width:0] [flex-direction:column] [gap:6px] [&_input]:[height:40px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_12px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&_input[aria-invalid='true']]:border-danger [&_select]:[height:40px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_12px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&_small]:[font-size:11.5px] [&_small]:[line-height:1.45] [&_small]:text-ink-subtle [&_small.error]:text-danger [&.wide]:[grid-column:1_/_-1] max-[720px]:[&.wide]:[grid-column:auto] [&>span]:[display:flex] [&>span]:[align-items:center] [&>span]:[gap:5px] [&>span]:[font-size:12px] [&>span]:[font-weight:600] [&>span]:text-ink-muted [&>span_b]:text-action [&>span_i]:[height:6px] [&>span_i]:[width:6px] [&>span_i]:[border-radius:999px] [&>span_i]:[background:var(--sf-warning)] ${className}`}
    >
      <span>{label}</span>
      <div className="sf-password-input [position:relative] [&_button]:[position:absolute] [&_button]:[top:0] [&_button]:[right:0] [&_button]:[display:grid] [&_button]:[height:40px] [&_button]:[width:40px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[padding:0] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_input]:[padding-right:42px]">
        <Input
          unstyled
          autoComplete={name === "current" ? "current-password" : "new-password"}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            name === "current"
              ? "Enter current password"
              : name === "confirm"
                ? "Repeat new password"
                : "New password"
          }
        />
        <Button
          unstyled
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onClick={onToggle}
          type="button"
        >
          <i className={`ph ph-eye${visible ? "-slash" : ""}`} />
        </Button>
      </div>
    </label>
  );
}
