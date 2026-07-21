import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MembersList } from "./members-list";
import { type Invitation, type Member, type PeopleTab } from "./site-settings-model";
import { SectionHeading } from "./settings-layout";

const matrix = [
  ["View assigned content", true, true, true, true, true],
  ["Create and edit content", true, true, true, true, false],
  ["Move and reorder pages", true, true, true, true, false],
  ["Delete content", true, true, true, "Scope only", false],
  ["Publish content", true, true, true, false, false],
  ["Manage languages / domains", true, true, false, false, false],
  ["Manage people", true, "Except owner", false, false, false],
  ["Transfer ownership / delete site", true, false, false, false, false],
] as const;

export function PeopleAccess({
  tab,
  members,
  invitations,
  siteName,
  readOnly,
  onTabChange,
  onInvite,
  onMember,
  onRevoke,
}: {
  tab: PeopleTab;
  members: Member[];
  invitations: Invitation[];
  siteName: string;
  readOnly: boolean;
  onTabChange: (tab: PeopleTab) => void;
  onInvite: () => void;
  onMember: (member: Member) => void;
  onRevoke: (invitation: Invitation) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return members.filter(
      (member) =>
        (role === "all" || member.role === role) &&
        (!normalized || `${member.name} ${member.email}`.toLowerCase().includes(normalized)),
    );
  }, [members, query, role]);

  return (
    <div className={cn("mx-auto", tab === "roles" ? "max-w-[940px]" : "max-w-[1080px]")}>
      <SectionHeading
        action={
          readOnly ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sunken px-2.5 text-xs font-semibold text-ink-muted">
              <i aria-hidden className="ph ph-eye" /> Read only
            </span>
          ) : (
            <Button onClick={onInvite} type="button">
              <i aria-hidden className="ph-bold ph-user-plus" /> Invite person
            </Button>
          )
        }
        description={`Manage who can work on ${siteName} and where their access applies.`}
        title="People & access"
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        <Tab
          active={tab === "members"}
          count={members.length}
          label="Members"
          onClick={() => onTabChange("members")}
        />
        <Tab
          active={tab === "invitations"}
          count={invitations.length}
          label="Invitations"
          onClick={() => onTabChange("invitations")}
          warning
        />
        <Tab
          active={tab === "roles"}
          label="Roles & permissions"
          onClick={() => onTabChange("roles")}
        />
      </div>

      {tab === "members" ? (
        <MembersList
          members={filteredMembers}
          onMember={onMember}
          onQuery={setQuery}
          onRole={setRole}
          query={query}
          readOnly={readOnly}
          role={role}
          total={members.length}
        />
      ) : null}
      {tab === "invitations" ? (
        <Invitations
          invitations={invitations}
          onInvite={onInvite}
          onRevoke={onRevoke}
          readOnly={readOnly}
        />
      ) : null}
      {tab === "roles" ? <RolesMatrix /> : null}
    </div>
  );
}

function Tab({
  active,
  label,
  count,
  warning,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  warning?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "flex h-10 items-center gap-2 border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-3 text-[12.5px] font-semibold whitespace-nowrap text-ink-muted",
        active && "border-action text-action",
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
      {count ? (
        <span
          className={cn(
            "rounded-full bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-muted",
            warning && "bg-concept-soft text-concept",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function Invitations({
  invitations,
  readOnly,
  onInvite,
  onRevoke,
}: {
  invitations: Invitation[];
  readOnly: boolean;
  onInvite: () => void;
  onRevoke: (invitation: Invitation) => void;
}) {
  if (!invitations.length)
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-panel border border-border bg-surface p-8 text-center">
        <i aria-hidden className="ph ph-paper-plane-tilt text-2xl text-ink-subtle" />
        <strong className="mt-2 text-sm">No pending invitations</strong>
        <p className="mt-1 mb-3 text-xs text-ink-muted">
          Invite someone when they need access to this website.
        </p>
        {!readOnly ? (
          <Button onClick={onInvite} size="sm" type="button">
            Invite person
          </Button>
        ) : null}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {invitations.map((invitation) => (
        <article
          className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 max-[700px]:flex-wrap"
          key={invitation.id}
        >
          <span className="grid size-9 place-items-center rounded-full bg-selection text-action">
            <i aria-hidden className="ph ph-envelope-simple" />
          </span>
          <div className="min-w-[210px] flex-1">
            <strong className="block text-[12.5px]">{invitation.email}</strong>
            <small className="text-[11px] text-ink-subtle">
              {invitation.role} · {invitation.access}
            </small>
          </div>
          <div className="text-[11px] text-ink-muted">
            <span className="block">Invited by {invitation.invitedBy}</span>
            <span>{invitation.sent}</span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold",
              invitation.status === "Pending"
                ? "bg-selection text-action"
                : "bg-concept-soft text-concept",
            )}
          >
            <i
              aria-hidden
              className={invitation.status === "Pending" ? "ph ph-clock" : "ph ph-hourglass-medium"}
            />
            {invitation.status}
          </span>
          {!readOnly ? (
            <Button
              aria-label={`Revoke invitation for ${invitation.email}`}
              onClick={() => onRevoke(invitation)}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <i aria-hidden className="ph ph-dots-three-vertical" />
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function RolesMatrix() {
  const roles = ["Owner", "Administrator", "Publisher", "Editor", "Viewer"];

  return (
    <section className="overflow-hidden rounded-panel border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h3 className="m-0 text-sm">Role presets</h3>
        <p className="mt-1 mb-0 text-[11.5px] text-ink-muted">
          A person's role controls what they can do. Their access scope controls where they can do
          it.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-center text-[11.5px]">
          <thead>
            <tr className="bg-rail">
              <th className="bg-rail sticky left-0 z-[1] min-w-[210px] px-4 py-3 text-left">
                Capability
              </th>
              {roles.map((role) => (
                <th className="min-w-[108px] px-2 py-3" key={role}>
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(([capability, ...values]) => (
              <tr className="border-t border-border" key={capability}>
                <th className="sticky left-0 bg-surface px-4 py-3 text-left font-medium">
                  {capability}
                </th>
                {values.map((value, index) => (
                  <td className="px-2 py-3 text-ink-muted" key={roles[index]}>
                    {value === true ? (
                      <i aria-label="Yes" className="ph-bold ph-check text-published" />
                    ) : value === false ? (
                      <i aria-label="No" className="ph ph-minus text-ink-subtle" />
                    ) : (
                      value
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
