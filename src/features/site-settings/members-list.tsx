import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { accessSummary, initials, roleMeta, type Member } from "./site-settings-model";

export function MembersList({
  members,
  total,
  query,
  role,
  readOnly,
  onQuery,
  onRole,
  onMember,
}: {
  members: Member[];
  total: number;
  query: string;
  role: string;
  readOnly: boolean;
  onQuery: (value: string) => void;
  onRole: (value: string) => void;
  onMember: (member: Member) => void;
}) {
  return (
    <section className="overflow-hidden rounded-panel border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border p-3 max-[620px]:flex-col">
        <div className="relative min-w-[220px] flex-1 max-[620px]:w-full">
          <i
            aria-hidden
            className="ph ph-magnifying-glass pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-subtle"
          />
          <Input
            aria-label="Search members"
            className="pl-9"
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search name or email"
            value={query}
          />
        </div>
        <div className="relative w-[180px] max-[620px]:w-full">
          <NativeSelect
            aria-label="Filter by role"
            onChange={(event) => onRole(event.target.value)}
            value={role}
          >
            <option value="all">All roles</option>
            {Object.keys(roleMeta).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </NativeSelect>
          <i
            aria-hidden
            className="ph ph-caret-down pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs"
          />
        </div>
        <span className="px-1 text-[11px] whitespace-nowrap text-ink-subtle">
          {members.length} of {total}
        </span>
      </div>
      {members.length ? (
        <>
          <div className="overflow-x-auto max-[760px]:hidden">
            <table className="w-full border-collapse text-left">
              <thead className="bg-rail text-[10.5px] tracking-[0.04em] text-ink-subtle uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Person</th>
                  <th className="px-3 py-2.5 font-semibold">Role</th>
                  <th className="px-3 py-2.5 font-semibold">Access</th>
                  <th className="px-3 py-2.5 font-semibold">Last active</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onMember={onMember}
                    readOnly={readOnly}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="hidden flex-col gap-2 p-3 max-[760px]:flex">
            {members.map((member) => (
              <MemberCard key={member.id} member={member} onMember={onMember} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
          <i aria-hidden className="ph ph-users text-2xl text-ink-subtle" />
          <strong className="mt-2 text-[13px]">No people match these filters</strong>
          <Button
            className="mt-3"
            onClick={() => {
              onQuery("");
              onRole("all");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear filters
          </Button>
        </div>
      )}
    </section>
  );
}

function MemberRow({
  member,
  readOnly,
  onMember,
}: {
  member: Member;
  readOnly: boolean;
  onMember: (member: Member) => void;
}) {
  const meta = roleMeta[member.role];

  return (
    <tr className="hover:bg-rail border-t border-border first:border-t-0">
      <td className="px-4 py-3">
        <Person member={member} />
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-flex rounded-md px-2 py-1 text-[10.5px] font-semibold",
            meta.className,
          )}
        >
          {member.role}
        </span>
        <small className="mt-1 block text-[10.5px] text-ink-subtle">{meta.description}</small>
      </td>
      <td className="px-3 py-3 text-[12px] text-ink-muted">{accessSummary(member)}</td>
      <td className="px-3 py-3 text-[12px] text-ink-muted" title={member.lastActiveExact}>
        {member.lastActive}
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          aria-label={`${readOnly ? "View" : "Change"} access for ${member.name}`}
          onClick={() => onMember(member)}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <i aria-hidden className={readOnly ? "ph ph-eye" : "ph ph-pencil-simple"} />
        </Button>
      </td>
    </tr>
  );
}

function MemberCard({ member, onMember }: { member: Member; onMember: (member: Member) => void }) {
  return (
    <button
      className="rounded-card border border-border bg-surface p-3 text-left"
      onClick={() => onMember(member)}
      type="button"
    >
      <Person member={member} />
      <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <span className="text-ink-subtle">
          Role<strong className="mt-0.5 block text-ink">{member.role}</strong>
        </span>
        <span className="text-ink-subtle">
          Access<strong className="mt-0.5 block text-ink">{accessSummary(member)}</strong>
        </span>
      </div>
    </button>
  );
}

function Person({ member }: { member: Member }) {
  return (
    <div className="flex min-w-[210px] items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-clay-soft text-[10.5px] font-bold text-clay-dark">
        {initials(member.name)}
      </span>
      <span className="min-w-0">
        <strong className="block text-[12.5px] font-semibold">
          {member.name}
          {member.current ? (
            <em className="ml-1.5 text-[10px] font-medium text-action not-italic">You</em>
          ) : null}
        </strong>
        <small className="block overflow-hidden text-[10.5px] text-ellipsis text-ink-subtle">
          {member.email}
        </small>
      </span>
    </div>
  );
}
