import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const minimumLength = 8;

/** Final step of a password reset: the reset link signed the user in; now they choose a password. */
export function SetPasswordForm({ onSave }: { onSave: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < minimumLength) {
      setError(`Use at least ${minimumLength} characters.`);

      return;
    }

    if (password !== repeat) {
      setError("The passwords do not match.");

      return;
    }

    setBusy(true);
    setError("");
    try {
      await onSave(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be saved.");
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-[23px] font-semibold text-ink">Set a new password</h2>
        <p className="m-0 text-[13.5px] text-ink-muted">
          Choose the password you will use to sign in from now on.
        </p>
      </div>
      {error ? (
        <p
          className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-ink" htmlFor="new-password">
          New password
        </label>
        <Input
          autoComplete="new-password"
          id="new-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold text-ink" htmlFor="repeat-password">
          Repeat new password
        </label>
        <Input
          autoComplete="new-password"
          id="repeat-password"
          onChange={(event) => setRepeat(event.target.value)}
          type="password"
          value={repeat}
        />
      </div>
      <Button disabled={busy} size="lg" type="submit">
        {busy ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
