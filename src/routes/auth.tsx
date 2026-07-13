import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
export const Route = createFileRoute("/auth")({ component: Auth });
type Mode = "signin" | "register" | "forgot" | "verify";
function Auth() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    signIn,
    signUp,
    signInWithProvider,
    requestPasswordReset,
  } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const mail = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");
    if (mode === "signin") await run(() => signIn(mail, password));
    if (mode === "register")
      await run(async () => {
        const r = await signUp(String(f.get("name") ?? ""), mail, password);
        if (r.needsEmailConfirmation) {
          setEmail(mail);
          setMode("verify");
        }
      });
    if (mode === "forgot")
      await run(async () => {
        await requestPasswordReset(mail);
        setNotice("If that account exists, a reset link is on its way.");
      });
  }
  return (
    <main className="sf-auth">
      <section className="sf-auth-brand">
        <div className="sf-auth-logo">
          <i className="ph-bold ph-hammer" />
          <strong>SiteFoundry</strong>
        </div>
        <div className="sf-auth-copy">
          <div>
            <label>Website-native CMS</label>
            <h1>Build, update and publish with the whole website in view.</h1>
            <p>
              SiteFoundry gives editors a clear page tree and one
              straightforward workflow for creating pages, composing content,
              previewing changes and publishing safely. Manage URLs, navigation,
              redirects, multiple languages and revisions alongside the content
              they belong to.
            </p>
          </div>
          <div className="sf-auth-open">
            <i className="ph-bold ph-code" />
            <span>
              <strong>Open-source and headless</strong>, with{" "}
              <strong>REST</strong> and <strong>GraphQL</strong> APIs for any
              frontend.
            </span>
          </div>
        </div>
        <div className="sf-auth-foot">
          © 2026 SiteFoundry · Self-hosted &amp; MIT-licensed
        </div>
      </section>
      <section className="sf-auth-panel">
        <div className="sf-auth-box">
          {error ? <div className="sf-auth-alert">{error}</div> : null}
          {notice ? <div className="sf-auth-notice">{notice}</div> : null}
          {mode === "verify" ? (
            <div className="sf-auth-terminal">
              <i className="ph ph-envelope-simple" />
              <div>
                <h2>Check your inbox</h2>
                <p>
                  We sent a verification link to {email}. Click it to activate
                  your account.
                </p>
              </div>
              <button
                className="sf-auth-primary"
                onClick={() => setMode("signin")}
                style={{ width: 280 }}
                type="button"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {mode !== "signin" ? (
                <button
                  className="sf-auth-back"
                  onClick={() => setMode("signin")}
                  type="button"
                >
                  <i className="ph-bold ph-arrow-left" />
                  Back to sign in
                </button>
              ) : null}
              <div className="sf-auth-heading">
                <h2>
                  {mode === "signin"
                    ? "Sign in to SiteFoundry"
                    : mode === "register"
                      ? "Create your account"
                      : "Reset your password"}
                </h2>
                <p>
                  {mode === "signin"
                    ? "Continue managing your website."
                    : mode === "register"
                      ? "Start building websites your editors will actually understand."
                      : "Enter your email and we will send you a reset link."}
                </p>
              </div>
              <form className="sf-auth-form" onSubmit={submit}>
                {mode === "signin" ? (
                  <div className="sf-auth-sso">
                    <button
                      className="sf-auth-secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(() => signInWithProvider("google"))
                      }
                      type="button"
                    >
                      <Google />
                      Continue with Google
                    </button>
                    <div className="sf-auth-divider">
                      or continue with email
                    </div>
                  </div>
                ) : null}
                <div className="sf-auth-fields">
                  {mode === "register" ? (
                    <Field
                      icon="ph-user"
                      label="Full name"
                      name="name"
                      placeholder="Mara Jensen"
                    />
                  ) : null}
                  <Field
                    icon="ph-envelope-simple"
                    label="Email"
                    name="email"
                    placeholder="you@company.com"
                    type="email"
                  />
                  {mode !== "forgot" ? (
                    <div className="sf-auth-field">
                      <div className="sf-auth-row">
                        <label
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "#33474A",
                          }}
                        >
                          Password
                        </label>
                        <span className="sf-spacer" />
                        {mode === "signin" ? (
                          <a onClick={() => setMode("forgot")}>
                            Forgot password?
                          </a>
                        ) : null}
                      </div>
                      <div className="sf-auth-input">
                        <i className="ph ph-lock-simple" />
                        <input
                          minLength={8}
                          name="password"
                          placeholder={
                            mode === "register"
                              ? "At least 8 characters"
                              : "Enter your password"
                          }
                          required
                          type={show ? "text" : "password"}
                        />
                        <button
                          aria-label="Toggle password"
                          onClick={() => setShow((v) => !v)}
                          type="button"
                        >
                          <i className={`ph ph-eye${show ? "-slash" : ""}`} />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {mode === "register" ? (
                    <label className="sf-auth-check">
                      <input required type="checkbox" />I agree to the Terms of
                      Service and Privacy Policy.
                    </label>
                  ) : null}
                </div>
                <button
                  className="sf-auth-primary"
                  disabled={busy}
                  type="submit"
                >
                  {busy
                    ? "Please wait..."
                    : mode === "signin"
                      ? "Sign in"
                      : mode === "register"
                        ? "Create account"
                        : "Send reset link"}
                  <i className="ph-bold ph-arrow-right" />
                </button>
              </form>
              {mode === "signin" ? (
                <p className="sf-auth-switch">
                  New to SiteFoundry?{" "}
                  <button onClick={() => setMode("register")} type="button">
                    Create an account
                  </button>
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
function Field({
  icon,
  label,
  name,
  placeholder,
  type = "text",
}: {
  icon: string;
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="sf-auth-field">
      <label>{label}</label>
      <div className="sf-auth-input">
        <i className={`ph ${icon}`} />
        <input name={name} placeholder={placeholder} required type={type} />
      </div>
    </div>
  );
}
function Google() {
  return (
    <svg aria-hidden="true" height="17" viewBox="0 0 48 48" width="17">
      <path
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        fill="#EA4335"
      />
      <path
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        fill="#4285F4"
      />
      <path
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
        fill="#FBBC05"
      />
      <path
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        fill="#34A853"
      />
    </svg>
  );
}
