import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { RouteLoading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  addSiteDomain,
  addSiteLanguage,
  createSiteInvitation,
  deleteSite,
  deleteSiteLanguage,
  requestDomainVerification,
  requestSiteExport,
  revokeSiteInvitation,
  saveSiteGeneralSettings,
  saveSiteMemberAccess,
  setDefaultSiteLanguage,
  setPrimarySiteDomain,
  transferSiteOwnership,
} from "@/lib/site-settings";

import { AdvancedSettings } from "./advanced-settings";
import { DomainsSettings } from "./domains-settings";
import { GeneralSettings } from "./general-settings";
import { InvitePersonDialog } from "./invite-person-dialog";
import { LanguagesSettings } from "./languages-settings";
import { MemberAccessDialog } from "./member-access-dialog";
import { PeopleAccess } from "./people-access";
import {
  invitationsFromWorkspace,
  languagesFromWorkspace,
  membersFromWorkspace,
  persistedRole,
  viewerRole,
} from "./site-settings-adapter";
import {
  type Invitation,
  type InvitationDraft,
  type Member,
  type PeopleTab,
  type SettingsDestination,
} from "./site-settings-model";
import { SettingsHeader, SettingsNavigation } from "./settings-layout";
import { useSiteSettingsWorkspace } from "./use-site-settings-workspace";

export function SiteSettingsScreen({
  destination,
  peopleTab,
  onDestinationChange,
  onPeopleTabChange,
}: {
  destination: SettingsDestination;
  peopleTab: PeopleTab;
  onDestinationChange: (destination: SettingsDestination) => void;
  onPeopleTabChange: (tab: PeopleTab) => void;
}) {
  const { user } = useAuth();
  const { workspace, loading, error, reload } = useSiteSettingsWorkspace(user?.id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [demotion, setDemotion] = useState<Member | null>(null);

  if (loading || !user) {
    return (
      <AppShell active="settings">
        <RouteLoading detail="Loading website configuration and access." title="Loading settings" />
      </AppShell>
    );
  }

  if (error || !workspace) {
    return (
      <AppShell active="settings">
        <div className="grid min-h-full place-items-center bg-canvas p-6 text-center">
          <div className="max-w-[460px] rounded-panel border border-border bg-surface p-7">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-soft text-xl text-danger">
              <i aria-hidden className="ph ph-warning-circle" />
            </span>
            <h1 className="mt-4 mb-1 text-lg">Site Settings could not be loaded</h1>
            <p className="mt-0 mb-4 text-[12px] leading-5 text-ink-muted">
              {error || "No website is available for this account."}
            </p>
            <Button onClick={() => void reload()} type="button" variant="outline">
              <i aria-hidden className="ph ph-arrow-clockwise" /> Retry
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const role = viewerRole(workspace.viewerRole);
  const readOnly = role !== "owner" && role !== "administrator";
  const members = membersFromWorkspace(workspace);
  const invitations = invitationsFromWorkspace(workspace);
  const siteLanguages = languagesFromWorkspace(workspace);
  const languageOptions = workspace.languages.map(({ id, name }) => ({ id, name }));
  const branchOptions = workspace.branches.map(({ id, name, languageName }) => ({
    id,
    name,
    language: languageName,
  }));
  const siteId = workspace.site.id;

  async function commitMember(member: Member) {
    await saveSiteMemberAccess(siteId, {
      id: member.id,
      role: persistedRole(member.role),
      accessScope: member.scope,
      languageIds: member.languages,
      branchIds: member.branches,
      sections: member.sections,
    });
    setSelectedMember(null);
    setDemotion(null);
    await reload();
    toast.success("Access updated", { description: member.name });
  }

  function saveMember(member: Member) {
    const current = members.find((candidate) => candidate.id === member.id);
    if (current?.role === "Administrator" && member.role !== "Administrator") {
      setDemotion(member);

      return;
    }

    void commitMember(member).catch(showMutationError);
  }

  async function sendInvitation(invitation: InvitationDraft) {
    const roleValue = persistedRole(invitation.role);
    if (roleValue === "owner")
      throw new Error("Ownership cannot be assigned through an invitation.");
    await createSiteInvitation(siteId, {
      email: invitation.email,
      role: roleValue,
      accessScope: invitation.accessScope,
      languageIds: invitation.languageIds,
      branchIds: invitation.branchIds,
      sections: invitation.sections,
    });
    await reload();
  }

  return (
    <AppShell
      active="settings"
      languageCode={workspace.languages.find((language) => language.isDefault)?.code ?? "en"}
      languageName={workspace.languages.find((language) => language.isDefault)?.name ?? "Language"}
      siteName={workspace.site.name}
    >
      <section className="flex min-h-0 flex-1 flex-col bg-canvas text-ink">
        <SettingsHeader siteName={workspace.site.name} viewerRole={role} />
        <div className="flex min-h-0 flex-1 max-[760px]:flex-col">
          <SettingsNavigation
            destination={destination}
            invitationCount={invitations.length}
            onChange={onDestinationChange}
          />
          <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6 max-[760px]:px-4 max-[760px]:py-5">
            {destination === "general" ? (
              <GeneralSettings
                languages={workspace.languages}
                onSave={async (form) => {
                  await saveSiteGeneralSettings(workspace.site.id, {
                    name: form.name,
                    slug: form.identifier,
                    timezone: form.timezone,
                    previewUrl: workspace.site.previewUrl,
                  });
                  if (form.defaultLanguageId)
                    await setDefaultSiteLanguage(workspace.site.id, form.defaultLanguageId);
                  await reload();
                }}
                readOnly={readOnly}
                site={workspace.site}
              />
            ) : null}
            {destination === "people" ? (
              <PeopleAccess
                invitations={invitations}
                members={members}
                onInvite={() => setInviteOpen(true)}
                onMember={setSelectedMember}
                onRevoke={setRevokeTarget}
                onTabChange={onPeopleTabChange}
                readOnly={readOnly}
                siteName={workspace.site.name}
                tab={peopleTab}
              />
            ) : null}
            {destination === "languages" ? (
              <LanguagesSettings
                languages={siteLanguages}
                onAdd={async (language) => {
                  await addSiteLanguage(workspace.site.id, language);
                  await reload();
                }}
                onRemove={async (languageId) => {
                  await deleteSiteLanguage(languageId);
                  await reload();
                }}
                onSetDefault={async (languageId) => {
                  await setDefaultSiteLanguage(workspace.site.id, languageId);
                  await reload();
                }}
                readOnly={readOnly}
              />
            ) : null}
            {destination === "domains" ? (
              <DomainsSettings
                domains={workspace.domains}
                languages={workspace.languages}
                onAdd={async (hostname) => {
                  await addSiteDomain(workspace.site.id, hostname);
                  await reload();
                }}
                onSavePreview={async (previewUrl) => {
                  await saveSiteGeneralSettings(workspace.site.id, {
                    name: workspace.site.name,
                    slug: workspace.site.slug,
                    timezone: workspace.site.timezone,
                    previewUrl,
                  });
                  await reload();
                }}
                onSetPrimary={async (domainId) => {
                  await setPrimarySiteDomain(workspace.site.id, domainId);
                  await reload();
                }}
                onVerify={async (domainId) => {
                  await requestDomainVerification(domainId);
                  await reload();
                }}
                previewUrl={workspace.site.previewUrl}
                readOnly={readOnly}
              />
            ) : null}
            {destination === "advanced" ? (
              <AdvancedSettings
                administrators={members.filter((member) => member.role === "Administrator")}
                canManage={!readOnly}
                currentOwner={members.find((member) => member.role === "Owner")}
                onDelete={async () => {
                  await deleteSite(workspace.site.id);
                  window.location.assign("/");
                }}
                onExport={() => requestSiteExport(workspace.site.id)}
                onTransfer={async (userId) => {
                  await transferSiteOwnership(workspace.site.id, userId);
                  await reload();
                }}
                owner={role === "owner"}
                siteName={workspace.site.name}
              />
            ) : null}
          </div>
        </div>
      </section>

      <InvitePersonDialog
        branches={branchOptions}
        languages={languageOptions}
        onOpenChange={setInviteOpen}
        onSend={sendInvitation}
        open={inviteOpen}
      />
      <MemberAccessDialog
        branches={branchOptions}
        languages={languageOptions}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onSave={saveMember}
        readOnly={readOnly}
      />
      <ConfirmDialog
        confirmLabel="Revoke invitation"
        description={
          revokeTarget
            ? `The invitation to ${revokeTarget.email} will no longer work. You can invite them again later.`
            : ""
        }
        onConfirm={() => {
          if (!revokeTarget) return;
          void revokeSiteInvitation(revokeTarget.id)
            .then(reload)
            .then(() => {
              toast.success("Invitation revoked", { description: revokeTarget.email });
              setRevokeTarget(null);
            })
            .catch(showMutationError);
        }}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        open={Boolean(revokeTarget)}
        title="Revoke invitation?"
      />
      <ConfirmDialog
        confirmLabel="Change role"
        description={
          demotion
            ? `Changing ${demotion.name} from Administrator removes the ability to manage people, languages, and domains.`
            : ""
        }
        onConfirm={() => demotion && void commitMember(demotion).catch(showMutationError)}
        onOpenChange={(open) => !open && setDemotion(null)}
        open={Boolean(demotion)}
        title={demotion ? `Reduce ${demotion.name}'s access?` : "Reduce access?"}
      />
    </AppShell>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader className="p-5 pr-12">
          <span className="mb-2 grid size-10 place-items-center rounded-full bg-danger-soft text-lg text-danger">
            <i aria-hidden className="ph ph-warning" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[12px] leading-5 text-ink-muted">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button onClick={onConfirm} type="button" variant="destructive">
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function showMutationError(reason: unknown) {
  toast.error(reason instanceof Error ? reason.message : "The change could not be saved.");
}
