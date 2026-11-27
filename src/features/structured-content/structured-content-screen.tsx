import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AppShell, StatusPill } from "@/components/app-shell";
import { AppShellSkeleton, LoadingSplash } from "@/components/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyStructuredValues,
  recordMatchesSearch,
  structuredFieldTypes,
  type StructuredField,
  type StructuredRecord,
  type StructuredType,
  type StructuredValue,
} from "@/lib/structured-content";
import {
  deleteStructuredRecord,
  deleteStructuredType,
  fieldKeyFromLabel,
  loadStructuredContentWorkspace,
  saveStructuredRecord,
  saveStructuredType,
  slugifyContentType,
  type StructuredContentWorkspace,
} from "@/lib/structured-content-data";
import { useRequireAuth } from "@/lib/use-require-auth";

export interface StructuredSearch {
  q?: string;
  status?: "published" | "concept";
  type?: string;
}

interface RecordDraft {
  id?: string;
  status: "published" | "concept";
  values: Record<string, StructuredValue>;
}

interface TypeDraft {
  id?: string;
  slug: string;
  name: string;
  singular: string;
  icon: string;
  fields: StructuredField[];
}

const typeIcons = [
  "ph-cube",
  "ph-users",
  "ph-map-pin",
  "ph-briefcase",
  "ph-question",
  "ph-quotes",
  "ph-calendar-dots",
  "ph-package",
  "ph-handshake",
  "ph-tag",
  "ph-star",
  "ph-newspaper",
];

export function StructuredContentScreen({ search }: { search: StructuredSearch }) {
  const navigate = useNavigate({ from: "/structured-content" });
  const { user, loading: authLoading } = useRequireAuth();
  const [workspace, setWorkspace] = useState<StructuredContentWorkspace | null>(null);
  const [types, setTypes] = useState<StructuredType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recordDraft, setRecordDraft] = useState<RecordDraft | null>(null);
  const [typeDraft, setTypeDraft] = useState<TypeDraft | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<StructuredRecord | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeType = types.find((type) => type.slug === search.type) ?? types[0] ?? null;
  const query = search.q ?? "";
  const status = search.status ?? "all";

  const loadWorkspace = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await loadStructuredContentWorkspace();
      setWorkspace(next);
      setTypes(next?.types ?? []);

      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load structured content");

      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void loadWorkspace();
    // The workspace should reload only when the authenticated user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const updateSearch = (next: StructuredSearch) =>
    void navigate({
      to: "/structured-content",
      search: { ...search, ...next },
      replace: true,
      resetScroll: false,
    });

  const selectType = (type: StructuredType) =>
    void navigate({
      to: "/structured-content",
      search: { type: type.slug },
      replace: true,
      resetScroll: false,
    });

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const primaryField = activeType?.fields.find((field) => field.primary) ?? activeType?.fields[0];
  const listFields =
    activeType && primaryField
      ? activeType.fields
          .filter(
            (field) =>
              field.key !== primaryField.key &&
              !["image", "long", "rich", "tags"].includes(field.type),
          )
          .slice(0, 3)
      : [];
  const records = useMemo(
    () =>
      (activeType?.records ?? []).filter(
        (record) =>
          (status === "all" || record.status === status) && recordMatchesSearch(record, query),
      ),
    [activeType, query, status],
  );
  const counts = {
    all: activeType?.records.length ?? 0,
    published: (activeType?.records ?? []).filter((item) => item.status === "published").length,
    concept: (activeType?.records ?? []).filter((item) => item.status === "concept").length,
  };

  if (authLoading || !user) return <LoadingSplash />;
  if (loading && !workspace)
    return (
      <AppShellSkeleton
        active="structured-content"
        label="Loading structured content"
        variant="table"
      />
    );

  if (error || !workspace || !activeType || !primaryField) {
    return (
      <AppShell active="structured-content">
        <div className="sc-loading [display:grid] [height:100vh] [width:100vw] [place-items:center] bg-canvas [font-size:13px] text-ink-muted [transition:background-color_140ms_ease,_color_140ms_ease,_border-color_140ms_ease] motion-reduce:[transition:none] dark:[color:#a7aeb8] dark:[background:#15181c]">
          {error || "No structured content workspace is available."}
        </div>
      </AppShell>
    );
  }

  const openNewRecord = () =>
    setRecordDraft({
      status: "concept",
      values: createEmptyStructuredValues(activeType.fields),
    });
  const openRecord = (record: StructuredRecord) =>
    setRecordDraft({
      id: record.id,
      status: record.status,
      values: structuredClone(record.values),
    });
  const setRecordValue = (key: string, value: StructuredValue) =>
    setRecordDraft((current) =>
      current ? { ...current, values: { ...current.values, [key]: value } } : current,
    );
  const saveRecord = async () => {
    if (!recordDraft || saving) return;
    const primaryValue = String(recordDraft.values[primaryField.key] ?? "").trim();
    if (!primaryValue) {
      showToast(`${primaryField.label} is required`);

      return;
    }

    setSaving(true);
    try {
      const saved = await saveStructuredRecord({
        ...recordDraft,
        contentTypeId: activeType.id,
        languageId: workspace.language.id,
      });
      setTypes((current) =>
        current.map((type) =>
          type.id === activeType.id
            ? {
                ...type,
                records: recordDraft.id
                  ? type.records.map((record) => (record.id === saved.id ? saved : record))
                  : [saved, ...type.records],
              }
            : type,
        ),
      );
      setRecordDraft(null);
      showToast(recordDraft.id ? "Structured item saved" : "Structured item created");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRecord = async () => {
    if (!deleteRecord || saving) return;
    setSaving(true);
    try {
      await deleteStructuredRecord(deleteRecord.id);
      setTypes((current) =>
        current.map((type) =>
          type.id === activeType.id
            ? {
                ...type,
                records: type.records.filter((record) => record.id !== deleteRecord.id),
              }
            : type,
        ),
      );
      setDeleteRecord(null);
      setRecordDraft(null);
      showToast("Structured item deleted");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not delete item");
    } finally {
      setSaving(false);
    }
  };

  const openNewType = () =>
    setTypeDraft({
      name: "",
      slug: "",
      singular: "",
      icon: "ph-cube",
      fields: [
        {
          id: `field-${Date.now()}`,
          key: "title",
          label: "Title",
          type: "text",
          primary: true,
          required: true,
        },
      ],
    });
  const openType = () =>
    setTypeDraft({
      id: activeType.id,
      slug: activeType.slug,
      name: activeType.name,
      singular: activeType.singular,
      icon: activeType.icon,
      fields: structuredClone(activeType.fields),
    });
  const updateTypeField = (id: string, patch: Partial<StructuredField>) =>
    setTypeDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === id ? { ...field, ...patch } : field,
            ),
          }
        : current,
    );
  const addTypeField = () => {
    const id = `field-${Date.now()}`;
    setTypeDraft((current) =>
      current
        ? {
            ...current,
            fields: [...current.fields, { id, key: id, label: "", type: "text" }],
          }
        : current,
    );
  };

  const saveType = async () => {
    if (!typeDraft?.name.trim() || saving) return;
    const usedKeys = new Set<string>();
    const normalizedFields = typeDraft.fields.map((item, index) => {
      const label = item.label.trim() || `Field ${index + 1}`;
      const isPersistedField = !item.id.startsWith("field-");
      const baseKey = isPersistedField ? item.key : fieldKeyFromLabel(label, index);
      let key = baseKey;
      let suffix = 2;
      while (usedKeys.has(key)) key = `${baseKey}${suffix++}`;
      usedKeys.add(key);

      return {
        ...item,
        key,
        label,
        primary: typeDraft.fields.some((field) => field.primary) ? item.primary : index === 0,
      };
    });
    const slug = typeDraft.id ? typeDraft.slug : slugifyContentType(typeDraft.name);
    setSaving(true);
    try {
      await saveStructuredType({
        id: typeDraft.id,
        languageId: workspace.language.id,
        slug,
        name: typeDraft.name.trim(),
        singular:
          typeDraft.singular.trim() || typeDraft.name.trim().replace(/s$/i, "").toLowerCase(),
        icon: typeDraft.icon,
        description: typeDraft.id ? activeType.description : "Custom structured content type.",
        fields: normalizedFields,
      });
      const next = await loadWorkspace();
      setTypeDraft(null);
      void navigate({
        to: "/structured-content",
        search: { type: slug },
        replace: true,
      });
      showToast(typeDraft.id ? "Content type updated" : "Content type created");
      if (!next) setError("Could not reload structured content");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not save content type");
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async () => {
    if (!typeDraft?.id || types.length <= 1 || saving) return;
    if (!window.confirm(`Delete the ${typeDraft.name} content type?`)) return;
    setSaving(true);
    try {
      const remaining = types.filter((type) => type.id !== typeDraft.id);
      const nextType = remaining[0];
      if (!nextType) throw new Error("At least one content type must remain");
      await deleteStructuredType(typeDraft.id);
      setTypes(remaining);
      setTypeDraft(null);
      void navigate({
        to: "/structured-content",
        search: { type: nextType.slug },
        replace: true,
      });
      showToast("Content type deleted");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Could not delete content type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      active="structured-content"
      siteName={workspace.site.name}
      languageName={workspace.language.name}
      languageCode={workspace.language.code}
    >
      <div className="sc-structured [display:flex] [min-height:0] [min-width:0] [flex:1] bg-surface text-ink">
        <aside className="sc-type-rail [display:flex] [min-height:0] [width:240px] [flex:0_0_240px] [flex-direction:column] bg-surface [border-right:1px_solid_var(--sc-border)] max-[980px]:[width:205px] max-[980px]:[flex-basis:205px] max-[760px]:[width:76px] max-[760px]:[flex-basis:76px] [&>header]:[display:flex] [&>header]:[align-items:center] [&>header]:[gap:8px] [&>header]:[padding:15px_16px_11px] [&>header_span]:text-ink-subtle [&>header_span]:[font:500_11.5px_'Geist_Mono',_monospace] [&>header_strong]:[font-size:13px] [&>header_strong]:[font-weight:600] max-[760px]:[&>header_strong]:[font-size:0]">
          <header>
            <strong>Content types</strong>
            <span>{types.length}</span>
          </header>
          <div className="sc-type-list sc-scroll [display:flex] [min-height:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [flex-direction:column] [gap:2px] [overflow:auto] [padding:0_10px_10px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff] [&>button_b]:text-ink-subtle [&>button_b]:[font:600_11px_'Geist_Mono',_monospace] max-[760px]:[&>button_b]:[font-size:0] [&>button_small]:[font-size:11px] [&>button_small]:text-ink-subtle [&>button_strong]:[overflow:hidden] [&>button_strong]:[font-size:13px] [&>button_strong]:[font-weight:500] [&>button_strong]:[text-overflow:ellipsis] [&>button_strong]:[white-space:nowrap] [&>button.active]:bg-selection [&>button.active]:[box-shadow:inset_2px_0_0_var(--sc-selection-rail)] [&>button.active_b]:text-action [&>button.active_strong]:[font-weight:600] [&>button.active_strong]:text-action-hover [&>button:not(.sc-new-type)]:[display:flex] [&>button:not(.sc-new-type)]:[width:100%] [&>button:not(.sc-new-type)]:[cursor:pointer] [&>button:not(.sc-new-type)]:[align-items:center] [&>button:not(.sc-new-type)]:[justify-content:flex-start] [&>button:not(.sc-new-type)]:[gap:10px] [&>button:not(.sc-new-type)]:[border-radius:9px] [&>button:not(.sc-new-type)]:[padding:8px_9px] [&>button:not(.sc-new-type)]:[text-align:left] [&>button:not(.sc-new-type)]:text-ink [&>button:not(.sc-new-type)]:[background:transparent] [&>button:not(.sc-new-type)]:[border:0] [&>button:not(.sc-new-type):hover]:bg-sunken dark:[&>button:not(.sc-new-type):hover]:[background:#22272d] [&>button>span:first-child]:[display:grid] [&>button>span:first-child]:[height:30px] [&>button>span:first-child]:[width:30px] [&>button>span:first-child]:[flex:none] [&>button>span:first-child]:[place-items:center] [&>button>span:first-child]:[border-radius:8px] [&>button>span:first-child]:[font-size:16px] [&>button>span:nth-child(2)]:[display:flex] [&>button>span:nth-child(2)]:[min-width:0] [&>button>span:nth-child(2)]:[flex:1] [&>button>span:nth-child(2)]:[flex-direction:column] [&>button>span:nth-child(2)]:[gap:1px] max-[760px]:[&>button>span:nth-child(2)]:[font-size:0]">
            {types.map((type) => {
              const active = type.id === activeType.id;

              return (
                <Button
                  className={active ? "active" : ""}
                  key={type.id}
                  onClick={() => selectType(type)}
                  variant="ghost"
                  type="button"
                >
                  <span style={{ background: type.chipBg, color: type.chipFg }}>
                    <i className={`ph ${type.icon}`} />
                  </span>
                  <span>
                    <strong>{type.name}</strong>
                    <small>{type.fields.length} fields</small>
                  </span>
                  <b>{type.records.length}</b>
                </Button>
              );
            })}
            <Button
              className="sc-new-type [margin-top:8px] [display:inline-flex] [min-height:38px] [cursor:pointer] [align-items:center] [justify-content:center] [gap:8px] [border-radius:9px] [font-size:12.5px] [font-weight:600] text-action-hover [background:transparent] [border:1.5px_dashed_#c7cfc8] max-[760px]:[width:48px] max-[760px]:[align-self:center] max-[760px]:[font-size:0] max-[760px]:[&_i]:[font-size:15px] [&:hover]:border-selection-border [&:hover]:bg-selection"
              onClick={openNewType}
              type="button"
              variant="ghost"
            >
              <i className="ph-bold ph-plus" /> New content type
            </Button>
          </div>
        </aside>

        <section className="sc-structured-main [display:flex] [min-height:0] [min-width:0] [flex:1] [flex-direction:column] bg-surface">
          <header className="sc-structured-header [display:flex] [min-height:86px] [align-items:center] [gap:12px] [padding:15px_20px] [border-bottom:1px_solid_var(--sc-border)] max-[760px]:[flex-wrap:wrap] [&_b]:text-ink-subtle [&_b]:[font:500_11.5px_'Geist_Mono',_monospace] [&_h1]:[margin:0] [&_h1]:[font-size:19px] [&_h1]:[font-weight:600] [&_h1]:[letter-spacing:-0.015em] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:text-ink-muted max-[980px]:[&_p]:[display:none] [&>div]:[display:flex] [&>div]:[min-width:0] [&>div]:[flex-direction:column] [&>div]:[gap:4px] [&>div>span]:[display:flex] [&>div>span]:[align-items:baseline] [&>div>span]:[gap:10px]">
            <span
              className="sc-structured-type-icon [display:grid] [height:42px] [width:42px] [flex:none] [place-items:center] [border-radius:10px] [font-size:21px]"
              style={{ background: activeType.chipBg, color: activeType.chipFg }}
            >
              <i className={`ph ${activeType.icon}`} />
            </span>
            <div>
              <span>
                <h1>{activeType.name}</h1>
                <b>{activeType.records.length} items</b>
              </span>
              <p>{activeType.description}</p>
            </div>
            <span className="sc-spacer [flex:1]" />
            <Button onClick={openType} type="button" variant="outline">
              <i className="ph ph-sliders-horizontal" /> Configure fields
            </Button>
            <Button disabled={saving} onClick={openNewRecord} type="button">
              <i className="ph-bold ph-plus" /> New {activeType.singular}
            </Button>
          </header>

          <div className="sc-structured-tools [display:flex] [min-height:58px] [align-items:center] [gap:10px] [padding:10px_20px] [background:#fafcfa] [border-bottom:1px_solid_var(--sc-border)] max-[760px]:[flex-wrap:wrap] dark:[background:#181b20] [&_.sc-search_button]:[display:flex] [&_.sc-search_button]:[cursor:pointer] [&_.sc-search_button]:[padding:0] [&_.sc-search_button]:text-ink-subtle [&_.sc-search_button]:[background:transparent] [&_.sc-search_button]:[border:0] [&>small]:text-ink-subtle [&>small]:[font:500_11.5px_'Geist_Mono',_monospace]">
            <label className="sc-search [display:flex] [height:36px] [width:248px] [align-items:center] [gap:8px] [border-radius:8px] bg-surface [padding:0_12px] [border:1.5px_solid_#cfd6d0] max-[800px]:[width:190px] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_i]:[font-size:15px] [&_i]:text-ink-subtle [&_input]:[width:100%] [&_input]:[padding:0] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
              <i className="ph ph-magnifying-glass" />
              <Input
                aria-label={`Search ${activeType.name}`}
                placeholder={`Search ${activeType.name.toLowerCase()}...`}
                value={query}
                onChange={(event) => updateSearch({ q: event.target.value || undefined })}
              />
              {query ? (
                <Button
                  aria-label="Clear search"
                  onClick={() => updateSearch({ q: undefined })}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <i className="ph ph-x" />
                </Button>
              ) : null}
            </label>
            <div className="sc-structured-segments [display:inline-flex] [gap:2px] [border-radius:9px] bg-sunken [padding:3px] [border:1px_solid_var(--sc-border)] [&_button]:[display:inline-flex] [&_button]:[height:28px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[border-radius:6px] [&_button]:[padding:0_10px] [&_button]:[font-size:11.5px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgb(23_35_38_/_12%)]">
              {(["all", "published", "concept"] as const).map((value) => (
                <Button
                  className={status === value ? "active" : ""}
                  key={value}
                  onClick={() => updateSearch({ status: value === "all" ? undefined : value })}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)} {counts[value]}
                </Button>
              ))}
            </div>
            <span className="sc-spacer [flex:1]" />
            <small>
              {query || status !== "all"
                ? `${records.length} of ${activeType.records.length} shown`
                : `${activeType.records.length} total`}
            </small>
          </div>

          <div className="sc-structured-table sc-scroll [min-height:0] [min-width:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            <div
              className="sc-structured-table-row header [display:grid] [min-height:50px] [width:100%] [min-width:840px] [align-items:center] [justify-content:stretch] [gap:14px] bg-surface [padding:0_18px] [text-align:left] text-ink [border-bottom:1px_solid_var(--sc-border)] [border:0] [&.header]:[position:sticky] [&.header]:[top:0] [&.header]:[z-index:2] [&.header]:[min-height:36px] [&.header]:[font-size:10px] [&.header]:[font-weight:600] [&.header]:[letter-spacing:0.06em] [&.header]:text-ink-subtle [&.header]:[text-transform:uppercase] [&.header]:[background:#fafcfa] dark:[&.header]:[background:#181b20] [button&]:[cursor:pointer] [button&:hover]:bg-sunken dark:[button&:hover]:[background:#22272d]"
              style={{
                gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${listFields.length}, minmax(120px, 1fr)) 118px 110px 78px`,
              }}
            >
              <span>{primaryField.label}</span>
              {listFields.map((field) => (
                <span key={field.id}>{field.label}</span>
              ))}
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {records.map((record) => {
              const primary = String(record.values[primaryField.key] || "(untitled)");

              return (
                <div
                  aria-label={`Edit ${primary}`}
                  className="sc-structured-table-row [display:grid] [min-height:50px] [width:100%] [min-width:840px] [align-items:center] [justify-content:stretch] [gap:14px] bg-surface [padding:0_18px] [text-align:left] text-ink [border-bottom:1px_solid_var(--sc-border)] [border:0] [&.header]:[position:sticky] [&.header]:[top:0] [&.header]:[z-index:2] [&.header]:[min-height:36px] [&.header]:[font-size:10px] [&.header]:[font-weight:600] [&.header]:[letter-spacing:0.06em] [&.header]:text-ink-subtle [&.header]:[text-transform:uppercase] [&.header]:[background:#fafcfa] dark:[&.header]:[background:#181b20] [button&]:[cursor:pointer] [button&:hover]:bg-sunken dark:[button&:hover]:[background:#22272d]"
                  key={record.id}
                  onClick={() => openRecord(record)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openRecord(record);
                  }}
                  role="button"
                  style={{
                    gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${listFields.length}, minmax(120px, 1fr)) 118px 110px 78px`,
                  }}
                  tabIndex={0}
                >
                  <span className="sc-structured-primary [display:flex] [min-width:0] [align-items:center] [gap:10px] [&>b]:[display:grid] [&>b]:[height:30px] [&>b]:[width:30px] [&>b]:[flex:none] [&>b]:[place-items:center] [&>b]:[border-radius:999px] [&>b]:[font-size:10px] [&>strong]:[overflow:hidden] [&>strong]:[font-size:12.5px] [&>strong]:[font-weight:500] [&>strong]:[text-overflow:ellipsis] [&>strong]:[white-space:nowrap]">
                    <b
                      style={{
                        background: activeType.chipBg,
                        color: activeType.chipFg,
                      }}
                    >
                      {initials(primary)}
                    </b>
                    <strong>{primary}</strong>
                  </span>
                  {listFields.map((field) => (
                    <span
                      className="sc-structured-cell [overflow:hidden] [font-size:11.5px] [font-weight:500] [text-overflow:ellipsis] [white-space:nowrap] text-ink-muted"
                      key={field.id}
                    >
                      {formatValue(record.values[field.key])}
                    </span>
                  ))}
                  <StatusPill status={record.status === "published" ? "Published" : "Concept"} />
                  <span className="sc-structured-updated [font-family:'Geist_Mono',_monospace] [font-size:11.5px] text-ink-muted">
                    {record.updated}
                  </span>
                  <span className="sc-structured-actions [display:flex] [justify-content:flex-end] [gap:4px] [font-size:15px] text-ink-subtle [&_i]:[display:grid] [&_i]:[height:26px] [&_i]:[width:26px] [&_i]:[place-items:center] [&_i]:[border-radius:6px] [&_i:hover]:bg-selection [&_i:hover]:text-action">
                    <i className="ph ph-pencil-simple" />
                    <Button
                      unstyled
                      aria-label={`Delete ${primary}`}
                      className="ph ph-trash"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteRecord(record);
                      }}
                      type="button"
                    />
                  </span>
                </div>
              );
            })}
            {!records.length ? (
              <div className="sc-structured-empty [display:flex] [min-height:320px] [flex-direction:column] [align-items:center] [justify-content:center] [gap:8px] [padding:40px] [text-align:center] [&>p]:[margin:0_0_8px] [&>p]:[font-size:12.5px] [&>p]:text-ink-muted [&>span]:[margin-bottom:4px] [&>span]:[display:grid] [&>span]:[height:48px] [&>span]:[width:48px] [&>span]:[place-items:center] [&>span]:[border-radius:12px] [&>span]:[font-size:23px] [&>strong]:[font-size:15px]">
                <span style={{ background: activeType.chipBg, color: activeType.chipFg }}>
                  <i
                    className={`ph ${query || status !== "all" ? "ph-magnifying-glass" : activeType.icon}`}
                  />
                </span>
                <strong>
                  {query || status !== "all"
                    ? `No matching ${activeType.name.toLowerCase()}`
                    : `No ${activeType.name.toLowerCase()} yet`}
                </strong>
                <p>
                  {query || status !== "all"
                    ? "Try another search or clear the status filter."
                    : `Add your first ${activeType.singular}.`}
                </p>
                <Button
                  onClick={() =>
                    query || status !== "all"
                      ? void navigate({
                          to: "/structured-content",
                          search: { type: activeType.slug },
                          replace: true,
                        })
                      : openNewRecord()
                  }
                  type="button"
                >
                  {query || status !== "all" ? "Clear filters" : `New ${activeType.singular}`}
                </Button>
              </div>
            ) : null}
          </div>
          <footer className="sc-structured-footer [display:flex] [min-height:38px] [align-items:center] [gap:8px] [padding:0_20px] [font-size:11.5px] text-ink-subtle [background:#fafcfa] [border-top:1px_solid_var(--sc-border)] dark:[background:#181b20] [&_i]:text-action">
            <span>
              <i className="ph ph-link-simple" /> Referenced by page blocks
            </span>
            <span className="sc-spacer [flex:1]" />
            <span>
              {activeType.fields.length} fields · {activeType.records.length} records
            </span>
          </footer>
        </section>
      </div>

      {recordDraft ? (
        <div
          className="sc-record-layer [position:fixed] [inset:6px_0_0] [z-index:55] [display:flex] [animation:sc-structured-fade_150ms_ease] [justify-content:flex-end] [background:rgb(23_35_38_/_32%)] motion-reduce:[animation:none] motion-reduce:[transition:none]"
          onMouseDown={(event) => event.target === event.currentTarget && setRecordDraft(null)}
          role="presentation"
        >
          <aside className="sc-record-drawer [display:flex] [height:100%] [width:min(520px,_94vw)] [animation:sc-structured-drawer_180ms_cubic-bezier(0.2,_0.8,_0.2,_1)] [flex-direction:column] bg-surface [box-shadow:-18px_0_50px_rgb(23_35_38_/_16%)] [border-left:1px_solid_var(--sc-border)] motion-reduce:[animation:none] motion-reduce:[transition:none] [&>footer]:[display:flex] [&>footer]:[min-height:60px] [&>footer]:[align-items:center] [&>footer]:[gap:8px] [&>footer]:bg-sunken [&>footer]:[padding:0_18px] [&>footer]:[border-top:1px_solid_var(--sc-border)] [&>header]:[display:flex] [&>header]:[min-height:66px] [&>header]:[align-items:center] [&>header]:[padding:0_18px] [&>header]:[border-bottom:1px_solid_var(--sc-border)] [&>header_button]:[display:grid] [&>header_button]:[height:32px] [&>header_button]:[width:32px] [&>header_button]:[cursor:pointer] [&>header_button]:[place-items:center] [&>header_button]:[border-radius:7px] [&>header_button]:text-ink-subtle [&>header_button]:[background:transparent] [&>header_button]:[border:0] [&>header_button:hover]:bg-selection [&>header_button:hover]:text-ink [&>header_small]:[font-size:11.5px] [&>header_small]:text-ink-subtle [&>header_strong]:[font-size:15px] [&>header>div]:[display:flex] [&>header>div]:[flex:1] [&>header>div]:[flex-direction:column] [&>header>div]:[gap:2px]">
            <header>
              <div>
                <strong>
                  {recordDraft.id ? "Edit" : "New"} {activeType.singular}
                </strong>
                <small>
                  {activeType.name} · {activeType.fields.length} fields
                </small>
              </div>
              <Button
                aria-label="Close record"
                onClick={() => setRecordDraft(null)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <i className="ph ph-x" />
              </Button>
            </header>
            <div className="sc-record-status [margin:14px_18px_0] [display:inline-flex] [gap:2px] [align-self:flex-start] [border-radius:9px] bg-sunken [padding:3px] [border:1px_solid_var(--sc-border)] [&_button]:[display:inline-flex] [&_button]:[height:28px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[border-radius:6px] [&_button]:[padding:0_10px] [&_button]:[font-size:11.5px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgb(23_35_38_/_12%)] [&_button>span]:[height:6px] [&_button>span]:[width:6px] [&_button>span]:[border-radius:50%] [&_button>span.concept]:[background:#d18f0c] [&_button>span.published]:[background:#1f9d57]">
              {(["concept", "published"] as const).map((value) => (
                <Button
                  className={recordDraft.status === value ? "active" : ""}
                  key={value}
                  onClick={() =>
                    setRecordDraft((current) => (current ? { ...current, status: value } : current))
                  }
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <span className={value} />
                  {value === "published" ? "Published" : "Concept"}
                </Button>
              ))}
            </div>
            <div className="sc-record-fields sc-scroll [display:flex] [min-height:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [flex-direction:column] [gap:18px] [overflow:auto] [padding:18px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
              {activeType.fields.map((field) => (
                <RecordField
                  field={field}
                  key={field.id}
                  value={recordDraft.values[field.key]}
                  onChange={(value) => setRecordValue(field.key, value)}
                />
              ))}
            </div>
            <footer>
              {recordDraft.id ? (
                <Button
                  className="sc-record-delete [cursor:pointer] [font-size:12px] [font-weight:600] text-danger [background:transparent] [border:0]"
                  onClick={() => {
                    const record = activeType.records.find((item) => item.id === recordDraft.id);
                    if (record) setDeleteRecord(record);
                  }}
                  type="button"
                  variant="link"
                >
                  Delete
                </Button>
              ) : null}
              <span className="sc-spacer [flex:1]" />
              <Button onClick={() => setRecordDraft(null)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={saving} loading={saving} onClick={saveRecord} type="button">
                {saving ? "Saving..." : recordDraft.id ? "Save changes" : "Create"}
              </Button>
            </footer>
          </aside>
        </div>
      ) : null}

      <TypeModal
        draft={typeDraft}
        onAddField={addTypeField}
        onChange={setTypeDraft}
        onDelete={deleteType}
        onFieldChange={updateTypeField}
        onSave={saveType}
        onClose={() => setTypeDraft(null)}
        saving={saving}
      />

      <Dialog open={Boolean(deleteRecord)} onOpenChange={(open) => !open && setDeleteRecord(null)}>
        <DialogContent showCloseButton={false}>
          <div className="sc-modal-head [display:flex] [align-items:flex-start] [gap:12px] [padding:18px_20px] [border-bottom:1px_solid_var(--sc-border)] dark:[border-color:#323841] [&_h2]:[margin:0] [&_h2]:[font-size:17px] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:text-ink-muted [&>button]:[display:grid] [&>button]:[height:32px] [&>button]:[width:32px] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:7px] [&>button]:text-ink-subtle [&>button]:[background:transparent] [&>button]:[border:0] [&>button:hover]:bg-selection [&>button:hover]:text-ink [&>div]:[display:flex] [&>div]:[flex:1] [&>div]:[flex-direction:column] [&>div]:[gap:3px]">
            <div>
              <DialogTitle>Delete structured item?</DialogTitle>
              <DialogDescription>This cannot be undone.</DialogDescription>
            </div>
            <DialogClose
              render={<Button aria-label="Close" size="icon-sm" type="button" variant="ghost" />}
            >
              <i className="ph ph-x" />
            </DialogClose>
          </div>
          <div className="sc-structured-delete-copy [display:flex] [align-items:center] [gap:12px] [padding:20px] [&_p]:[margin:0] [&_p]:[font-size:13px] [&_p]:[line-height:1.5] [&_p]:text-ink-muted [&_strong]:[display:block] [&_strong]:text-ink [&>span]:[display:grid] [&>span]:[height:40px] [&>span]:[width:40px] [&>span]:[flex:none] [&>span]:[place-items:center] [&>span]:[border-radius:9px] [&>span]:bg-danger-soft [&>span]:[font-size:19px] [&>span]:text-danger">
            <span>
              <i className="ph ph-trash" />
            </span>
            <p>
              <strong>
                {deleteRecord ? String(deleteRecord.values[primaryField.key] || "Untitled") : ""}
              </strong>
              will be removed from {activeType.name.toLowerCase()}.
            </p>
          </div>
          <div className="sc-modal-actions [display:flex] [min-height:62px] [align-items:center] [gap:8px] bg-sunken [padding:0_20px] [border-top:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[background:#242930]">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={saving}
              loading={saving}
              onClick={confirmDeleteRecord}
              type="button"
              variant="destructive"
            >
              {saving ? "Deleting..." : "Delete item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast ? (
        <div
          className="fixed bottom-[26px] left-1/2 z-[90] flex -translate-x-1/2 animate-in items-center gap-2.5 rounded-[11px] bg-ink px-4 py-3 text-[13px] font-semibold text-white shadow-[0_14px_40px_rgb(23_35_38_/_32%)] duration-200 fade-in-0 slide-in-from-bottom-2 dark:border dark:border-field dark:bg-sunken dark:text-ink [&_i]:text-lg [&_i]:text-[#b994f8]"
          role="status"
        >
          <i className="ph-fill ph-check-circle" /> {toast}
        </div>
      ) : null}
    </AppShell>
  );
}

function RecordField({
  field,
  value,
  onChange,
}: {
  field: StructuredField;
  value: StructuredValue | undefined;
  onChange: (value: StructuredValue) => void;
}) {
  const meta = structuredFieldTypes[field.type];
  const stringValue = typeof value === "string" ? value : "";
  const tags = Array.isArray(value) ? value : [];
  const [tagDraft, setTagDraft] = useState("");
  const addTag = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !tagDraft.trim()) return;
    event.preventDefault();
    onChange([...tags, tagDraft.trim()]);
    setTagDraft("");
  };

  return (
    <label className="sc-record-field [display:flex] [flex-direction:column] [gap:7px] [&_textarea]:[resize:vertical] [&_textarea]:[line-height:1.5] [&>input]:[min-height:38px] [&>input]:[width:100%] [&>input]:[border-radius:8px] [&>input]:bg-surface [&>input]:[padding:8px_10px] [&>input]:[font-size:13px] [&>input]:text-ink [&>input]:[outline:none] [&>input]:[border:1.5px_solid_var(--sc-field)] dark:[&>input]:[border-color:#3d444e] [&>input:focus]:border-action [&>input:focus]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)] [&>select]:[min-height:38px] [&>select]:[width:100%] [&>select]:[border-radius:8px] [&>select]:bg-surface [&>select]:[padding:8px_10px] [&>select]:[font-size:13px] [&>select]:text-ink [&>select]:[outline:none] [&>select]:[border:1.5px_solid_var(--sc-field)] dark:[&>select]:[border-color:#3d444e] [&>select:focus]:border-action [&>select:focus]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)] [&>span]:[display:flex] [&>span]:[align-items:center] [&>span]:[justify-content:space-between] [&>span_small]:[display:inline-flex] [&>span_small]:[align-items:center] [&>span_small]:[gap:4px] [&>span_small]:[font-size:10.5px] [&>span_small]:text-ink-subtle [&>span_strong]:[font-size:12px] [&>span_strong]:[font-weight:600] [&>span_strong_b]:text-danger [&>textarea]:[min-height:38px] [&>textarea]:[width:100%] [&>textarea]:[border-radius:8px] [&>textarea]:bg-surface [&>textarea]:[padding:8px_10px] [&>textarea]:[font-size:13px] [&>textarea]:text-ink [&>textarea]:[outline:none] [&>textarea]:[border:1.5px_solid_var(--sc-field)] dark:[&>textarea]:[border-color:#3d444e] [&>textarea:focus]:border-action [&>textarea:focus]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)]">
      <span>
        <strong>
          {field.label}
          {field.required ? <b>*</b> : null}
        </strong>
        <small>
          <i className={`ph ${meta.icon}`} /> {meta.label}
        </small>
      </span>
      {field.type === "toggle" ? (
        <span className="sc-structured-switch-row [display:inline-flex] [width:fit-content] [align-items:center] [gap:8px] [font-size:12px] text-ink-muted">
          <Switch
            aria-label={field.label}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked)}
          />
          {value === true ? "Enabled" : "Disabled"}
        </span>
      ) : field.type === "tags" ? (
        <div className="sc-tags-input [display:flex] [min-height:40px] [flex-wrap:wrap] [align-items:center] [gap:4px] [border-radius:8px] bg-surface [padding:4px] [border:1.5px_solid_var(--sc-field)] [transition:border-color_120ms_ease,_box-shadow_120ms_ease] dark:[border-color:#3d444e] [&_.sc-tag-chip]:[display:inline-flex] [&_.sc-tag-chip]:[height:28px] [&_.sc-tag-chip]:[cursor:pointer] [&_.sc-tag-chip]:[align-items:center] [&_.sc-tag-chip]:[gap:4px] [&_.sc-tag-chip]:[border-radius:6px] [&_.sc-tag-chip]:bg-selection [&_.sc-tag-chip]:[padding:0_8px] [&_.sc-tag-chip]:[font-size:12px] [&_.sc-tag-chip]:[font-weight:400] [&_.sc-tag-chip]:text-ink-muted [&_.sc-tag-chip]:[border:0] [&_.sc-tag-chip:focus-visible]:[box-shadow:none] [&_.sc-tags-input-control]:[height:28px] [&_.sc-tags-input-control]:[width:auto] [&_.sc-tags-input-control]:[min-width:150px] [&_.sc-tags-input-control]:[flex:1_1_150px] [&_.sc-tags-input-control]:[border-radius:0] [&_.sc-tags-input-control]:[padding:0_4px] [&_.sc-tags-input-control]:[font-size:12px] [&_.sc-tags-input-control]:text-ink [&_.sc-tags-input-control]:[box-shadow:none] [&_.sc-tags-input-control]:[outline:0] [&_.sc-tags-input-control]:[background:transparent] [&_.sc-tags-input-control]:[border:0] [&_.sc-tags-input-control:focus-visible]:[border-color:transparent] [&_.sc-tags-input-control:focus-visible]:[box-shadow:none] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)]">
          {tags.map((tag) => (
            <Button
              aria-label={`Remove ${tag} tag`}
              className="sc-tag-chip"
              key={tag}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              size="xs"
              type="button"
              variant="secondary"
            >
              {tag} <i className="ph ph-x" />
            </Button>
          ))}
          <Input
            className="sc-tags-input-control"
            placeholder="Add tag and press Enter"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={addTag}
          />
        </div>
      ) : field.type === "image" ? (
        <Button
          className="sc-image-field [display:flex] [min-height:54px] [cursor:pointer] [align-items:center] [gap:10px] [border-radius:8px] bg-surface [padding:8px_10px] [text-align:left] text-ink-muted [border:1.5px_solid_var(--sc-field)] dark:[border-color:#3d444e] [&_small]:[font-size:10.5px] [&_small]:text-ink-subtle [&_strong]:[font-size:12px] [&_strong]:text-ink [&>i:first-child]:[display:grid] [&>i:first-child]:[height:34px] [&>i:first-child]:[width:34px] [&>i:first-child]:[place-items:center] [&>i:first-child]:[border-radius:7px] [&>i:first-child]:bg-selection [&>i:first-child]:[font-size:17px] [&>i:first-child]:text-action [&>span]:[display:flex] [&>span]:[flex:1] [&>span]:[flex-direction:column]"
          onClick={() => onChange("selected-image.jpg")}
          type="button"
          variant="outline"
        >
          <i className="ph ph-image" />
          <span>
            <strong>{stringValue || "No image selected"}</strong>
            <small>Choose from the media library</small>
          </span>
          <i className="ph ph-caret-right" />
        </Button>
      ) : field.type === "choice" || field.type === "reference" ? (
        <Select
          value={stringValue || null}
          onValueChange={(nextValue) => onChange(nextValue ?? "")}
        >
          <SelectTrigger aria-label={field.label}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "long" || field.type === "rich" ? (
        <div
          className={
            field.type === "rich"
              ? "sc-rich-field [overflow:hidden] [border-radius:8px] [border:1.5px_solid_var(--sc-field)] dark:[border-color:#3d444e] [&_textarea]:[min-height:38px] [&_textarea]:[width:100%] [&_textarea]:[resize:vertical] [&_textarea]:[border-radius:0] [&_textarea]:bg-surface [&_textarea]:[padding:8px_10px] [&_textarea]:[font-size:13px] [&_textarea]:[line-height:1.5] [&_textarea]:text-ink [&_textarea]:[box-shadow:none] [&_textarea]:[outline:none] [&_textarea]:[border:0] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)]"
              : ""
          }
        >
          {field.type === "rich" ? (
            <div className="sc-rich-tools [display:flex] [gap:2px] bg-sunken [padding:5px] [border-bottom:1px_solid_var(--sc-border)] [&_button]:[display:grid] [&_button]:[height:27px] [&_button]:[width:27px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:5px] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] [&_button:hover]:bg-surface [&_button:hover]:text-action">
              {[
                "ph-text-b",
                "ph-text-italic",
                "ph-list-bullets",
                "ph-list-numbers",
                "ph-link-simple",
              ].map((icon) => (
                <Button aria-label={icon} key={icon} size="icon-xs" type="button" variant="ghost">
                  <i className={`ph ${icon}`} />
                </Button>
              ))}
            </div>
          ) : null}
          <Textarea
            rows={field.type === "rich" ? 6 : 4}
            value={stringValue}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : (
        <Input
          type={
            field.type === "date"
              ? "date"
              : field.type === "number"
                ? "number"
                : field.type === "email"
                  ? "email"
                  : field.type === "url"
                    ? "url"
                    : "text"
          }
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function TypeModal({
  draft,
  onChange,
  onFieldChange,
  onAddField,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  draft: TypeDraft | null;
  onChange: (value: TypeDraft | null) => void;
  onFieldChange: (id: string, patch: Partial<StructuredField>) => void;
  onAddField: () => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sc-type-modal [width:min(760px,_calc(100vw_-_32px))]"
        showCloseButton={false}
      >
        <div className="sc-modal-head [display:flex] [align-items:flex-start] [gap:12px] [padding:18px_20px] [border-bottom:1px_solid_var(--sc-border)] dark:[border-color:#323841] [&_h2]:[margin:0] [&_h2]:[font-size:17px] [&_p]:[margin:0] [&_p]:[font-size:12px] [&_p]:text-ink-muted [&>button]:[display:grid] [&>button]:[height:32px] [&>button]:[width:32px] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:7px] [&>button]:text-ink-subtle [&>button]:[background:transparent] [&>button]:[border:0] [&>button:hover]:bg-selection [&>button:hover]:text-ink [&>div]:[display:flex] [&>div]:[flex:1] [&>div]:[flex-direction:column] [&>div]:[gap:3px]">
          <div>
            <DialogTitle>
              {draft?.id ? `Configure · ${draft.name}` : "New content type"}
            </DialogTitle>
            <DialogDescription>
              Define a reusable collection and the fields it stores.
            </DialogDescription>
          </div>
          <DialogClose
            render={<Button aria-label="Close" size="icon-sm" type="button" variant="ghost" />}
          >
            <i className="ph ph-x" />
          </DialogClose>
        </div>
        {draft ? (
          <div className="sc-type-modal-body sc-scroll [display:flex] [max-height:min(620px,_calc(100vh_-_190px))] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [flex-direction:column] [gap:18px] [overflow:auto] [padding:18px_20px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
            <div className="sc-type-basics [display:grid] [grid-template-columns:1fr_1fr] [gap:12px] max-[760px]:[grid-template-columns:1fr] [&_input]:[min-height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:8px_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:none] [&_input]:[border:1.5px_solid_var(--sc-field)] dark:[&_input]:[border-color:#3d444e] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[gap:6px] [&_label>span]:[font-size:11.5px] [&_label>span]:[font-weight:600]">
              <label htmlFor="content-type-name">
                <span>Name</span>
                <Input
                  id="content-type-name"
                  value={draft.name}
                  onChange={(event) => onChange({ ...draft, name: event.target.value })}
                  placeholder="e.g. Partners"
                />
              </label>
              <label htmlFor="content-type-singular">
                <span>Singular name</span>
                <Input
                  id="content-type-singular"
                  value={draft.singular}
                  onChange={(event) => onChange({ ...draft, singular: event.target.value })}
                  placeholder="e.g. partner"
                />
              </label>
            </div>
            <div className="sc-type-icons [display:flex] [flex-direction:column] [gap:6px] [&_button]:[display:grid] [&_button]:[height:36px] [&_button]:[width:36px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:8px] [&_button]:bg-surface [&_button]:text-ink-muted [&_button]:[border:1px_solid_var(--sc-border)] [&_button.active]:border-action [&_button.active]:bg-selection [&_button.active]:text-action [&>div]:[display:flex] [&>div]:[flex-wrap:wrap] [&>div]:[gap:6px] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600]">
              <span>Icon</span>
              <div>
                {typeIcons.map((icon) => (
                  <Button
                    aria-label={icon}
                    className={draft.icon === icon ? "active" : ""}
                    key={icon}
                    onClick={() => onChange({ ...draft, icon })}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <i className={`ph ${icon}`} />
                  </Button>
                ))}
              </div>
            </div>
            <div className="sc-type-fields-head [display:flex] [align-items:center] [gap:8px] [padding-top:4px] [&_span]:text-ink-subtle [&_span]:[font:500_11px_'Geist_Mono',_monospace] [&_strong]:[font-size:12.5px]">
              <strong>Fields</strong>
              <span>{draft.fields.length} fields</span>
            </div>
            <div className="sc-type-fields [display:flex] [flex-direction:column] [gap:7px] [&_button]:[display:grid] [&_button]:[height:30px] [&_button]:[width:30px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:6px] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_button:disabled]:[cursor:default] [&_button:disabled]:[opacity:0.35] [&_input]:[min-height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:8px_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:none] [&_input]:[border:1.5px_solid_var(--sc-field)] dark:[&_input]:[border-color:#3d444e] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)] [&_select]:[min-height:38px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:8px_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:none] [&_select]:[border:1.5px_solid_var(--sc-field)] dark:[&_select]:[border-color:#3d444e] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_var(--sc-focus-ring)] [&>div]:[display:grid] [&>div]:[grid-template-columns:30px_minmax(150px,_1fr)_170px_30px] [&>div]:[align-items:center] [&>div]:[gap:8px] [&>div]:[border-radius:9px] [&>div]:bg-surface [&>div]:[padding:8px] [&>div]:[border:1px_solid_var(--sc-border)] [&>div.primary]:bg-selection-surface dark:[&>div.primary]:bg-selection">
              {draft.fields.map((field) => (
                <div className={field.primary ? "primary" : ""} key={field.id}>
                  <Button
                    aria-label="Set as primary field"
                    className="sc-primary-field [&_i.ph-fill]:text-action"
                    onClick={() =>
                      onChange({
                        ...draft,
                        fields: draft.fields.map((item) => ({
                          ...item,
                          primary: item.id === field.id,
                        })),
                      })
                    }
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <i className={`ph${field.primary ? "-fill" : ""} ph-star`} />
                  </Button>
                  <Input
                    value={field.label}
                    onChange={(event) => onFieldChange(field.id, { label: event.target.value })}
                    placeholder="Field name"
                  />
                  <Select
                    value={field.type}
                    onValueChange={(value) => onFieldChange(field.id, { type: value! })}
                  >
                    <SelectTrigger aria-label={`${field.label || "Field"} type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(structuredFieldTypes).map(([value, item]) => (
                        <SelectItem key={value} value={value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    aria-label="Remove field"
                    disabled={draft.fields.length === 1}
                    onClick={() =>
                      onChange({
                        ...draft,
                        fields: draft.fields.filter((item) => item.id !== field.id),
                      })
                    }
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <i className="ph ph-trash" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              className="sc-add-field [margin:0] [margin-top:8px] [display:inline-flex] [min-height:38px] [width:100%] [cursor:pointer] [align-items:center] [justify-content:center] [gap:8px] [border-radius:9px] [font-size:12.5px] [font-weight:600] text-action-hover [background:transparent] [border:1.5px_dashed_#c7cfc8] [&:hover]:border-selection-border [&:hover]:bg-selection"
              onClick={onAddField}
              type="button"
              variant="outline"
            >
              <i className="ph-bold ph-plus" /> Add field
            </Button>
          </div>
        ) : null}
        <div className="sc-modal-actions [display:flex] [min-height:62px] [align-items:center] [gap:8px] bg-sunken [padding:0_20px] [border-top:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[background:#242930]">
          {draft?.id ? (
            <Button
              className="sc-type-delete [cursor:pointer] [font-size:12px] [font-weight:600] text-danger [background:transparent] [border:0]"
              disabled={saving}
              onClick={onDelete}
              type="button"
              variant="link"
            >
              Delete type
            </Button>
          ) : null}
          <span className="sc-spacer [flex:1]" />
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button
            disabled={!draft?.name.trim() || saving}
            loading={saving}
            onClick={onSave}
            type="button"
          >
            {saving ? "Saving..." : draft?.id ? "Save fields" : "Create type"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatValue(value: StructuredValue | undefined) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (value === true) return "Yes";
  if (value === false) return "No";

  return value || "—";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
