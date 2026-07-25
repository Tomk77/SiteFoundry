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
import { NativeSelect } from "@/components/ui/native-select";

import type { Member } from "./site-settings-model";
import { Field, SectionHeading, SettingsCard } from "./settings-layout";

type Guard = "transfer" | "delete" | null;

export function AdvancedSettings({
  owner,
  canManage,
  siteName,
  currentOwner,
  administrators,
  onExport,
  onTransfer,
  onDelete,
}: {
  owner: boolean;
  canManage: boolean;
  siteName: string;
  currentOwner?: Member;
  administrators: Member[];
  onExport: () => Promise<void>;
  onTransfer: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [guard, setGuard] = useState<Guard>(null);
  const [confirmation, setConfirmation] = useState("");
  const [newOwner, setNewOwner] = useState(administrators[0]?.id ?? "");
  const matches = confirmation === siteName;

  function closeGuard() {
    setGuard(null);
    setConfirmation("");
  }

  function runGuardedAction() {
    if (!guard || !matches) return;
    setWorking(true);
    const action = guard === "transfer" ? onTransfer(newOwner) : onDelete();
    void action
      .then(() => {
        toast.success(guard === "transfer" ? "Ownership transferred" : "Website deleted");
        closeGuard();
      })
      .catch((reason: unknown) =>
        toast.error(
          reason instanceof Error ? reason.message : "The operation could not be completed.",
        ),
      )
      .finally(() => setWorking(false));
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <SectionHeading
        description="Protected website lifecycle actions and portable data exports."
        title="Advanced"
      />
      <div className="flex flex-col gap-4">
        <SettingsCard
          description="The owner has full control and protects website lifecycle actions."
          icon="ph-crown"
          title="Ownership"
        >
          <div className="flex items-center gap-3 max-[620px]:flex-wrap">
            <span className="grid size-10 place-items-center rounded-full bg-clay-soft text-xs font-bold text-clay-dark">
              {currentOwner?.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("") ?? "O"}
            </span>
            <div className="min-w-[220px] flex-1">
              <strong className="block text-[13px]">{currentOwner?.name ?? "Site owner"}</strong>
              <small className="text-[11px] text-ink-subtle">
                {currentOwner?.email ?? "Email unavailable"} · Current owner
              </small>
            </div>
            <Button
              disabled={!owner || !administrators.length}
              onClick={() => setGuard("transfer")}
              size="sm"
              title={
                !owner
                  ? "Only the owner can transfer ownership"
                  : !administrators.length
                    ? "Promote a member to Administrator first"
                    : undefined
              }
              type="button"
              variant="outline"
            >
              Transfer ownership
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          description="Request a portable copy of content, structure, and settings."
          icon="ph-download-simple"
          title="Export website data"
        >
          <div className="flex items-center justify-between gap-4 max-[620px]:flex-col max-[620px]:items-start">
            <p className="m-0 max-w-[560px] text-[11.5px] leading-5 text-ink-muted">
              The request is queued for a background export worker. Existing website content is not
              changed.
            </p>
            <Button
              disabled={!canManage}
              loading={working}
              onClick={() => {
                setWorking(true);
                void onExport()
                  .then(() => toast.success("Export requested", { description: "Status: queued" }))
                  .catch((reason: unknown) =>
                    toast.error(
                      reason instanceof Error ? reason.message : "Could not request the export.",
                    ),
                  )
                  .finally(() => setWorking(false));
              }}
              size="sm"
              title={canManage ? undefined : "Only an owner or administrator can export site data"}
              type="button"
              variant="outline"
            >
              Request export
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          danger
          description="Destructive actions affect the entire website and cannot be casually undone."
          icon="ph-warning"
          title="Danger zone"
        >
          <div className="flex items-center justify-between gap-4 max-[620px]:flex-col max-[620px]:items-start">
            <div>
              <strong className="text-[13px]">Delete this website</strong>
              <p className="mt-1 mb-0 max-w-[560px] text-[11.5px] leading-5 text-ink-muted">
                {siteName}, its language trees, content, navigation, redirects, and settings will be
                permanently deleted from Scaffold CMS.
              </p>
            </div>
            <Button
              disabled={!owner}
              onClick={() => setGuard("delete")}
              size="sm"
              type="button"
              variant="destructive"
            >
              Delete website
            </Button>
          </div>
        </SettingsCard>
      </div>

      <Dialog onOpenChange={(open) => !open && closeGuard()} open={Boolean(guard)}>
        <DialogContent>
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>
              {guard === "transfer" ? "Transfer ownership" : `Delete ${siteName}?`}
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-5 text-ink-muted">
              {guard === "transfer"
                ? "The selected administrator becomes owner. You will become an Administrator."
                : "This permanently deletes the website and cascades to its managed database records."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            {guard === "transfer" ? (
              <Field label="New owner">
                <div className="relative">
                  <NativeSelect
                    onChange={(event) => setNewOwner(event.target.value)}
                    value={newOwner}
                  >
                    {administrators.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} · {member.email}
                      </option>
                    ))}
                  </NativeSelect>
                  <i
                    aria-hidden
                    className="ph ph-caret-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs"
                  />
                </div>
              </Field>
            ) : null}
            <Field hint="This check is case-sensitive." label={`Type “${siteName}” to confirm`}>
              <Input
                autoComplete="off"
                autoFocus
                onChange={(event) => setConfirmation(event.target.value)}
                value={confirmation}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-4">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={!matches || (guard === "transfer" && !newOwner)}
              loading={working}
              onClick={runGuardedAction}
              type="button"
              variant={guard === "delete" ? "destructive" : "default"}
            >
              {guard === "transfer" ? "Transfer ownership" : "Delete website"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
