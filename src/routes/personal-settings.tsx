import { Button } from "../components/ui/button";
import { LoadingSplash, RouteLoading } from "../components/loading";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import {
  applyInterfaceMode,
  changePassword,
  interfaceLanguages,
  loadPersonalSettings,
  savePersonalSettings,
  usesPasswordAuthentication,
  type PersonalSettings as PersonalSettingsValue,
} from "../lib/personal-settings";
import "../redirects.css";
import "../personal-settings.css";

export const Route = createFileRoute("/personal-settings")({
  component: PersonalSettings,
});

const emptySettings: PersonalSettingsValue = {
  firstName: "",
  lastName: "",
  email: "",
  displayName: "",
  interfaceLanguage: "en",
  interfaceMode: "system",
};

function PersonalSettings() {
  const navigate = useNavigate();
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
  if (!user) return <div className="sf-loading">Redirecting to sign in...</div>;

  return (
    <main className="sf-personal-settings">
      <header className="sf-personal-top">
        <Button unstyled onClick={leave} type="button">
          <i className="ph-bold ph-arrow-left" /> Back to app
        </Button>
        <span className="sf-personal-mark">
          <i className="ph-bold ph-hammer" />
        </span>
        <div>
          <strong>Personal settings</strong>
          <small>Applies to your account across every website</small>
        </div>
        <span className="sf-spacer" />
        <span className="sf-personal-saved">
          {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {dirty ? (
          <Button
            unstyled
            className="sf-personal-discard"
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
          className="sf-personal-save"
          disabled={!dirty || !valid || saving}
          loading={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </header>

      <div className="sf-personal-scroll sf-scroll">
        <div className="sf-personal-content">
          <section className="sf-account-summary">
            <span className="sf-personal-avatar">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <small>{form.email}</small>
            </div>
            <span className="sf-spacer" />
            <b>Account-wide</b>
          </section>

          <SettingsSection
            icon="ph-user"
            title="Profile"
            description="Your name and sign-in identity"
          >
            <div className="sf-profile-grid">
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
              <div className="sf-password-grid">
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
                <div className="sf-password-policy">
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
                  <span className="sf-spacer" />
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
                {passwordError ? <p className="sf-personal-error wide">{passwordError}</p> : null}
              </div>
            ) : (
              <div className="sf-provider-guidance">
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
            <div className="sf-experience-grid">
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
                <div className="sf-mode-options">
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
            <div className="sf-personal-notice">
              <i className="ph-fill ph-envelope-simple" />
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="sf-personal-error">
              <i className="ph-fill ph-warning-circle" />
              {error}
            </div>
          ) : null}
        </div>
      </div>
      {toast ? (
        <div className="sf-global-toast" role="status">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function PersonalSettingsLoading() {
  return (
    <main aria-busy="true" className="sf-personal-settings">
      <header className="sf-personal-top">
        <Button unstyled disabled type="button">
          <i className="ph-bold ph-arrow-left" /> Back to app
        </Button>
        <span className="sf-personal-mark">
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
    <section className="sf-settings-card">
      <header>
        <span>
          <i className={`ph ${icon}`} />
        </span>
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
      </header>
      <div className="sf-settings-card-body">{children}</div>
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
    <label className={`sf-setting-field ${className}`}>
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
    <label className={`sf-setting-field ${className}`}>
      <span>{label}</span>
      <div className="sf-password-input">
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
