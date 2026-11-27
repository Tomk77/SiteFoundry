import { Button } from "@/components/ui/button";
import { LoadingSplash } from "@/components/loading";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";

type Mode = "signin" | "register" | "forgot" | "verify";

function formString(form: FormData, key: string) {
  const value = form.get(key);

  return typeof value === "string" ? value : "";
}

export function AuthScreen({ resetRequested = false }: { resetRequested?: boolean }) {
  const navigate = useNavigate({ from: "/auth" });
  const auth = useAuth();
  const { user, loading, signIn, signUp, signInWithProvider, requestPasswordReset } = auth;
  // A reset link signs the user in; they must set a password before going on (finding 5.4).
  const recovering = resetRequested || auth.passwordRecovery;
  const [mode, setMode] = useState<Mode>("signin");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (!loading && user && !recovering) void navigate({ to: "/" });
  }, [loading, user, navigate, recovering]);
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
    const mail = formString(f, "email");
    const password = formString(f, "password");
    if (mode === "signin") await run(() => signIn(mail, password));
    if (mode === "register")
      await run(async () => {
        const r = await signUp(formString(f, "name"), mail, password);
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

  if (loading) return <LoadingSplash />;

  return (
    <main className="sc-auth [display:flex] [height:100vh] [width:100vw] [overflow:hidden]">
      <section className="sc-auth-brand [position:relative] [display:flex] [width:42%] [max-width:560px] [flex:none] [flex-direction:column] [overflow:hidden] bg-action-hover [padding:44px] [color:#e9ecf1] max-[780px]:[display:none] [&:before]:[position:absolute] [&:before]:[inset:0] [&:before]:[background-image:radial-gradient(_circle_at_1px_1px,_rgba(255,_255,_255,_0.06)_1px,_transparent_0_)] [&:before]:[background-size:22px_22px] [&:before]:[content:'']">
        <div className="sc-auth-logo [position:relative] [display:flex] [align-items:center] [gap:11px] [&_i]:[display:grid] [&_i]:[height:34px] [&_i]:[width:34px] [&_i]:[place-items:center] [&_i]:[border-radius:9px] [&_i]:bg-clay [&_i]:[font-size:18px] [&_i]:text-ink [&_strong]:[font-size:16px] [&_strong]:[font-weight:600]">
          <i className="ph-bold ph-hammer" />
          <strong>Scaffold CMS</strong>
        </div>
        <div className="sc-auth-copy [position:relative] [display:flex] [max-width:400px] [flex:1] [flex-direction:column] [justify-content:center] [gap:26px] [&_h1]:[margin:0] [&_h1]:[font-size:31px] [&_h1]:[line-height:1.18] [&_h1]:[font-weight:600] [&_h1]:[letter-spacing:-0.02em] [&_h1]:[color:#fff] [&_label]:[font-size:11px] [&_label]:[font-weight:600] [&_label]:[letter-spacing:0.12em] [&_label]:[color:#7fc8c9] [&_label]:[text-transform:uppercase] [&_p]:[margin:0] [&_p]:[font-size:14.5px] [&_p]:[line-height:1.62] [&_p]:[color:#b7d4d3] [&>div]:[display:flex] [&>div]:[flex-direction:column] [&>div]:[gap:14px]">
          <div>
            <span className="sc-auth-eyebrow">Website-native CMS</span>
            <h1>Build, update and publish with the whole website in view.</h1>
            <p>
              Scaffold CMS gives editors a clear page tree and one straightforward workflow for
              creating pages, composing content, previewing changes and publishing safely. Manage
              URLs, navigation, redirects, multiple languages and revisions alongside the content
              they belong to.
            </p>
          </div>
          <div className="sc-auth-open [display:flex] [align-items:flex-start] [gap:11px] [padding-top:16px] [font-size:13.5px] [line-height:1.55] [color:#b7d4d3] [border-top:1px_solid_rgba(255,_255,_255,_0.12)] [&_i]:[display:grid] [&_i]:[height:24px] [&_i]:[width:24px] [&_i]:[flex:none] [&_i]:[place-items:center] [&_i]:[border-radius:7px] [&_i]:[color:#7fc8c9] [&_i]:[background:rgba(185,_148,_248,_0.18)]">
            <i className="ph-bold ph-code" />
            <span>
              <strong>Open-source and headless</strong>, with <strong>REST</strong> and{" "}
              <strong>GraphQL</strong> APIs for any frontend.
            </span>
          </div>
        </div>
        <div className="sc-auth-foot [position:relative] [font-size:12px] [color:#6fa6a6]">
          © 2026 Scaffold CMS · Self-hosted &amp; MIT-licensed
        </div>
      </section>
      <section className="sc-auth-panel [display:flex] [min-width:0] [flex:1] [align-items:center] [justify-content:center] [overflow:auto] [padding:32px] max-[780px]:[padding:24px] dark:[background:#15181c]">
        <div className="sc-auth-box [display:flex] [width:100%] [max-width:400px] [flex-direction:column] [gap:22px]">
          {error ? (
            <div className="sc-auth-alert [border-radius:9px] bg-danger-soft [padding:11px_13px] [font-size:12.5px] text-danger [border:1px_solid_#eec6bc]">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="sc-auth-notice [border-radius:9px] [padding:11px_13px] [font-size:12.5px] text-action [background:#f1f7f6] [border:1px_solid_#d7e7e4] dark:[border-color:#515a65] dark:[color:#b994f8] dark:[background:#2c333b]">
              {notice}
            </div>
          ) : null}
          {recovering && user ? (
            <SetPasswordForm
              onSave={async (password) => {
                await auth.updatePassword(password);
                await navigate({ to: "/" });
              }}
            />
          ) : recovering && !notice ? (
            <div className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink-muted">
              This reset link has expired or was already used. Use "Forgot password?" to request a
              new one.
            </div>
          ) : null}
          {recovering && user ? null : mode === "verify" ? (
            <div className="sc-auth-terminal [display:flex] [flex-direction:column] [align-items:center] [gap:18px] [padding:20px_0] [text-align:center] [&_h2]:[margin:0_0_7px] [&_h2]:[font-size:20px] dark:[&_h2]:[color:#e9ecf1] [&_i]:[display:grid] [&_i]:[height:60px] [&_i]:[width:60px] [&_i]:[place-items:center] [&_i]:[border-radius:16px] [&_i]:bg-selection [&_i]:[font-size:32px] [&_i]:text-action dark:[&_i]:[color:#b994f8] dark:[&_i]:[background:#2c333b] [&_p]:[margin:0] [&_p]:[font-size:14px] [&_p]:[line-height:1.55] [&_p]:text-ink-muted dark:[&_p]:[color:#a7aeb8]">
              <i className="ph ph-envelope-simple" />
              <div>
                <h2>Check your inbox</h2>
                <p>We sent a verification link to {email}. Click it to activate your account.</p>
              </div>
              <Button
                unstyled
                className="sc-auth-primary [display:flex] [height:46px] [cursor:pointer] [align-items:center] [justify-content:center] [gap:10px] [border-radius:9px] bg-action [font-size:14px] [font-weight:600] [color:#fff] [box-shadow:0_1px_2px_rgba(23,_35,_38,_0.12)] [border:0]"
                onClick={() => setMode("signin")}
                style={{ width: 280 }}
                type="button"
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {mode !== "signin" ? (
                <Button
                  unstyled
                  className="sc-auth-back [display:inline-flex] [width:max-content] [cursor:pointer] [align-items:center] [gap:6px] [padding:0] [font-size:13px] [font-weight:600] text-ink-muted [background:transparent] [border:0]"
                  onClick={() => setMode("signin")}
                  type="button"
                >
                  <i className="ph-bold ph-arrow-left" />
                  Back to sign in
                </Button>
              ) : null}
              <div className="sc-auth-heading [display:flex] [flex-direction:column] [gap:6px] [&_h2]:[margin:0] [&_h2]:[font-size:23px] [&_h2]:[font-weight:600] [&_h2]:[letter-spacing:-0.02em] dark:[&_h2]:[color:#e9ecf1] [&_p]:[margin:0] [&_p]:[font-size:14px] [&_p]:[line-height:1.5] [&_p]:text-ink-muted dark:[&_p]:[color:#a7aeb8]">
                <h2>
                  {mode === "signin"
                    ? "Sign in to Scaffold CMS"
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
              <form
                className="sc-auth-form [display:flex] [flex-direction:column] [gap:22px]"
                onSubmit={submit}
              >
                {mode === "signin" ? (
                  <div className="sc-auth-sso [display:flex] [flex-direction:column] [gap:10px]">
                    <Button
                      unstyled
                      className="sc-auth-secondary [display:flex] [height:46px] [cursor:pointer] [align-items:center] [justify-content:center] [gap:10px] [border-radius:9px] bg-surface [font-size:14px] [font-weight:600] [border:1px_solid_#cfd6d0] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126]"
                      disabled={busy}
                      onClick={() => void run(() => signInWithProvider("google"))}
                      type="button"
                    >
                      <Google />
                      Continue with Google
                    </Button>
                    <div className="sc-auth-divider [display:flex] [align-items:center] [gap:10px] [padding:2px_0] [font-size:11.5px] [font-weight:500] text-ink-subtle dark:[&::after]:[background:#323841] dark:[&::before]:[background:#323841] [&:after]:[height:1px] [&:after]:[flex:1] [&:after]:[content:''] [&:after]:[background:#e2e7e2] [&:before]:[height:1px] [&:before]:[flex:1] [&:before]:[content:''] [&:before]:[background:#e2e7e2]">
                      or continue with email
                    </div>
                  </div>
                ) : null}
                <div className="sc-auth-fields [display:flex] [flex-direction:column] [gap:14px]">
                  {mode === "register" ? (
                    <Field icon="ph-user" label="Full name" name="name" placeholder="Mara Jensen" />
                  ) : null}
                  <Field
                    icon="ph-envelope-simple"
                    label="Email"
                    name="email"
                    placeholder="you@company.com"
                    type="email"
                  />
                  {mode !== "forgot" ? (
                    <div className="sc-auth-field [display:flex] [flex-direction:column] [gap:6px] [&>label]:[font-size:12.5px] [&>label]:[font-weight:600] [&>label]:[color:#33474a] dark:[&>label]:[color:#e9ecf1]">
                      <div className="sc-auth-row [display:flex] [align-items:center] [&_a]:[cursor:pointer] [&_a]:[font-size:12px] [&_a]:[font-weight:600] [&_a]:text-action [&_a]:[background:transparent] [&_a]:[border:0]">
                        <label
                          htmlFor="auth-password"
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "#33474A",
                          }}
                        >
                          Password
                        </label>
                        <span className="sc-spacer [flex:1]" />
                        {mode === "signin" ? (
                          <Button unstyled onClick={() => setMode("forgot")} type="button">
                            Forgot password?
                          </Button>
                        ) : null}
                      </div>
                      <div className="sc-auth-input [display:flex] [height:44px] [align-items:center] [gap:9px] [border-radius:9px] bg-surface [padding:0_12px] [border:1.5px_solid_#cfd6d0] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_button]:[display:flex] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_i]:[font-size:16px] [&_i]:text-ink-subtle [&_input]:[width:100%] [&_input]:[padding:0] [&_input]:[font-size:14px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
                        <i className="ph ph-lock-simple" />
                        <Input
                          unstyled
                          id="auth-password"
                          minLength={8}
                          name="password"
                          placeholder={
                            mode === "register" ? "At least 8 characters" : "Enter your password"
                          }
                          required
                          type={show ? "text" : "password"}
                        />
                        <Button
                          unstyled
                          aria-label="Toggle password"
                          onClick={() => setShow((v) => !v)}
                          type="button"
                        >
                          <i className={`ph ph-eye${show ? "-slash" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {mode === "register" ? (
                    <label
                      className="sc-auth-check [display:flex] [align-items:flex-start] [gap:9px] [font-size:12.5px] [line-height:1.5] [color:#33474a] dark:[color:#e9ecf1] [&_input]:[margin:1px_0_0] [&_input]:[height:18px] [&_input]:[width:18px] [&_input]:[accent-color:#763fba]"
                      htmlFor="auth-terms"
                    >
                      <Input unstyled id="auth-terms" required type="checkbox" />I agree to the
                      Terms of Service and Privacy Policy.
                    </label>
                  ) : null}
                </div>
                <Button
                  unstyled
                  className="sc-auth-primary [display:flex] [height:46px] [cursor:pointer] [align-items:center] [justify-content:center] [gap:10px] [border-radius:9px] bg-action [font-size:14px] [font-weight:600] [color:#fff] [box-shadow:0_1px_2px_rgba(23,_35,_38,_0.12)] [border:0]"
                  disabled={busy}
                  loading={busy}
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
                </Button>
              </form>
              {mode === "signin" ? (
                <p className="sc-auth-switch [margin:0] [text-align:center] [font-size:13px] text-ink-muted dark:[color:#a7aeb8] [&_button]:[cursor:pointer] [&_button]:[font-size:13px] [&_button]:[font-weight:600] [&_button]:text-action [&_button]:[background:transparent] [&_button]:[border:0]">
                  New to Scaffold CMS?{" "}
                  <Button unstyled onClick={() => setMode("register")} type="button">
                    Create an account
                  </Button>
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
    <div className="sc-auth-field [display:flex] [flex-direction:column] [gap:6px] [&>label]:[font-size:12.5px] [&>label]:[font-weight:600] [&>label]:[color:#33474a] dark:[&>label]:[color:#e9ecf1]">
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className="sc-auth-input [display:flex] [height:44px] [align-items:center] [gap:9px] [border-radius:9px] bg-surface [padding:0_12px] [border:1.5px_solid_#cfd6d0] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_button]:[display:flex] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_i]:[font-size:16px] [&_i]:text-ink-subtle [&_input]:[width:100%] [&_input]:[padding:0] [&_input]:[font-size:14px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
        <i className={`ph ${icon}`} />
        <Input
          unstyled
          id={`auth-${name}`}
          name={name}
          placeholder={placeholder}
          required
          type={type}
        />
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
