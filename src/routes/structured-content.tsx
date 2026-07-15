import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AppShell, StatusPill } from "../components/app-shell";
import { AppShellSkeleton, LoadingSplash } from "../components/loading";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import {
  createEmptyStructuredValues,
  recordMatchesSearch,
  structuredFieldTypes,
  type StructuredField,
  type StructuredRecord,
  type StructuredType,
  type StructuredValue,
} from "../lib/structured-content";
import {
  deleteStructuredRecord,
  deleteStructuredType,
  fieldKeyFromLabel,
  loadStructuredContentWorkspace,
  saveStructuredRecord,
  saveStructuredType,
  slugifyContentType,
  type StructuredContentWorkspace,
} from "../lib/structured-content-data";
import { useAuth } from "../lib/auth";
import "../structured-content.css";

interface StructuredSearch {
  q?: string;
  status?: "published" | "concept";
  type?: string;
}

export const Route = createFileRoute("/structured-content")({
  validateSearch: (search: Record<string, unknown>): StructuredSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    status:
      search.status === "published" || search.status === "concept" ? search.status : undefined,
    type: typeof search.type === "string" && search.type.trim() ? search.type : undefined,
  }),
  component: StructuredContent,
});

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

function StructuredContent() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
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
        <div className="sf-loading">{error || "No structured content workspace is available."}</div>
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
      <div className="sf-structured">
        <aside className="sf-type-rail">
          <header>
            <strong>Content types</strong>
            <span>{types.length}</span>
          </header>
          <div className="sf-type-list sf-scroll">
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
            <Button className="sf-new-type" onClick={openNewType} type="button" variant="ghost">
              <i className="ph-bold ph-plus" /> New content type
            </Button>
          </div>
        </aside>

        <section className="sf-structured-main">
          <header className="sf-structured-header">
            <span
              className="sf-structured-type-icon"
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
            <span className="sf-spacer" />
            <Button onClick={openType} type="button" variant="outline">
              <i className="ph ph-sliders-horizontal" /> Configure fields
            </Button>
            <Button disabled={saving} onClick={openNewRecord} type="button">
              <i className="ph-bold ph-plus" /> New {activeType.singular}
            </Button>
          </header>

          <div className="sf-structured-tools">
            <label className="sf-search">
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
            <div className="sf-structured-segments">
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
            <span className="sf-spacer" />
            <small>
              {query || status !== "all"
                ? `${records.length} of ${activeType.records.length} shown`
                : `${activeType.records.length} total`}
            </small>
          </div>

          <div className="sf-structured-table sf-scroll">
            <div
              className="sf-structured-table-row header"
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
                  className="sf-structured-table-row"
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
                  <span className="sf-structured-primary">
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
                    <span className="sf-structured-cell" key={field.id}>
                      {formatValue(record.values[field.key])}
                    </span>
                  ))}
                  <StatusPill status={record.status === "published" ? "Published" : "Concept"} />
                  <span className="sf-structured-updated">{record.updated}</span>
                  <span className="sf-structured-actions">
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
              <div className="sf-structured-empty">
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
          <footer className="sf-structured-footer">
            <span>
              <i className="ph ph-link-simple" /> Referenced by page blocks
            </span>
            <span className="sf-spacer" />
            <span>
              {activeType.fields.length} fields · {activeType.records.length} records
            </span>
          </footer>
        </section>
      </div>

      {recordDraft ? (
        <div
          className="sf-record-layer"
          onMouseDown={(event) => event.target === event.currentTarget && setRecordDraft(null)}
          role="presentation"
        >
          <aside className="sf-record-drawer">
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
            <div className="sf-record-status">
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
            <div className="sf-record-fields sf-scroll">
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
                  className="sf-record-delete"
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
              <span className="sf-spacer" />
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
          <div className="sf-modal-head">
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
          <div className="sf-structured-delete-copy">
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
          <div className="sf-modal-actions">
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
        <div className="sf-global-toast" role="status">
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
    <label className="sf-record-field">
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
        <span className="sf-structured-switch-row">
          <Switch
            aria-label={field.label}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked)}
          />
          {value === true ? "Enabled" : "Disabled"}
        </span>
      ) : field.type === "tags" ? (
        <div className="sf-tags-input">
          {tags.map((tag) => (
            <Button
              aria-label={`Remove ${tag} tag`}
              className="sf-tag-chip"
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
            className="sf-tags-input-control"
            placeholder="Add tag and press Enter"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={addTag}
          />
        </div>
      ) : field.type === "image" ? (
        <Button
          className="sf-image-field"
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
        <div className={field.type === "rich" ? "sf-rich-field" : ""}>
          {field.type === "rich" ? (
            <div className="sf-rich-tools">
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
      <DialogContent className="sf-type-modal" showCloseButton={false}>
        <div className="sf-modal-head">
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
          <div className="sf-type-modal-body sf-scroll">
            <div className="sf-type-basics">
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
            <div className="sf-type-icons">
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
            <div className="sf-type-fields-head">
              <strong>Fields</strong>
              <span>{draft.fields.length} fields</span>
            </div>
            <div className="sf-type-fields">
              {draft.fields.map((field) => (
                <div className={field.primary ? "primary" : ""} key={field.id}>
                  <Button
                    aria-label="Set as primary field"
                    className="sf-primary-field"
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
            <Button className="sf-add-field" onClick={onAddField} type="button" variant="outline">
              <i className="ph-bold ph-plus" /> Add field
            </Button>
          </div>
        ) : null}
        <div className="sf-modal-actions">
          {draft?.id ? (
            <Button
              className="sf-type-delete"
              disabled={saving}
              onClick={onDelete}
              type="button"
              variant="link"
            >
              Delete type
            </Button>
          ) : null}
          <span className="sf-spacer" />
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
