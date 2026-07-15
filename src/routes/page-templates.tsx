import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "../components/app-shell";
import { LoadingSplash } from "../components/loading";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "../components/modal";
import { PageTemplateEditor } from "../components/page-template-editor";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NativeSelect } from "../components/ui/native-select";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../lib/auth";
import {
  slugifyTemplateKey,
  templateComponentSummary,
  validatePageTemplate,
  type PageTemplateDefinition,
} from "../lib/page-templates";
import {
  deletePageTemplate,
  loadPageTemplateWorkspace,
  savePageTemplate,
  setFallbackPageTemplate,
  type PageTemplateWorkspace,
} from "../lib/page-templates-data";
import type { WorkspaceOption } from "../lib/page-tree";
import "../page-templates.css";

export const Route = createFileRoute("/page-templates")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    template: typeof search.template === "string" ? search.template : undefined,
  }),
  component: PageTemplatesRoute,
});

interface CreateDraft {
  name: string;
  key: string;
  keyEdited: boolean;
  description: string;
  icon: string;
  fallback: boolean;
  startingPoint: "empty" | "duplicate";
  duplicateKey: string;
}

const icons = [
  "ph-file",
  "ph-newspaper",
  "ph-article",
  "ph-flag-banner",
  "ph-question",
  "ph-house",
  "ph-stack",
  "ph-layout",
  "ph-megaphone",
  "ph-storefront",
];

function PageTemplatesRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<PageTemplateWorkspace | null>(null);
  const [templates, setTemplates] = useState<PageTemplateDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [menuKey, setMenuKey] = useState("");
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [rename, setRename] = useState<{ key: string; name: string } | null>(null);
  const [deleteKey, setDeleteKey] = useState("");
  const [fallbackKey, setFallbackKey] = useState("");
  const query = search.q ?? "";
  const editingKey = search.template ?? "";
  const currentFallback = templates.find((template) => template.fallback);
  const editing = templates.find((template) => template.key === editingKey);
  const load = async (selection?: { siteId?: string; languageId?: string }) => {
    setLoading(true);
    setError("");
    try {
      const nextWorkspace = await loadPageTemplateWorkspace(selection);
      setWorkspace(nextWorkspace);
      if (!nextWorkspace) {
        setTemplates([]);
        return;
      }
      setTemplates(nextWorkspace.templates);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load page templates.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user) void load();
    // Site selection is intentionally initialized once for the signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/auth" });
  }, [authLoading, navigate, user]);
  const updateSearch = (next: { q?: string; template?: string }) =>
    void navigate({
      to: "/page-templates",
      search: { q: next.q || undefined, template: next.template || undefined },
      replace: true,
      resetScroll: false,
    });
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? templates.filter((template) =>
          `${template.name} ${template.key} ${template.description}`.toLowerCase().includes(needle),
        )
      : templates;
  }, [query, templates]);
  const openCreate = (source?: PageTemplateDefinition) =>
    setCreateDraft({
      name: source ? `${source.name} copy` : "",
      key: source ? slugifyTemplateKey(`${source.name} copy`) : "",
      keyEdited: false,
      description: source?.description ?? "",
      icon: source?.icon ?? "ph-file",
      fallback: false,
      startingPoint: source ? "duplicate" : "empty",
      duplicateKey: source?.key ?? templates[0]?.key ?? "",
    });
  const createKey = createDraft ? slugifyTemplateKey(createDraft.key || createDraft.name) : "";
  const createKeyError =
    createDraft && createDraft.name.trim()
      ? !/^[a-z][a-z0-9-]*$/.test(createKey)
        ? "Use lowercase letters, numbers and hyphens, starting with a letter."
        : templates.some((template) => template.key === createKey)
          ? "A template with this key already exists."
          : ""
      : "";
  const submitCreate = async () => {
    if (!createDraft || !workspace || !createDraft.name.trim() || createKeyError || !createKey)
      return;
    const source = templates.find((template) => template.key === createDraft.duplicateKey);
    const definition: PageTemplateDefinition = {
      key: createKey,
      name: createDraft.name.trim(),
      description: createDraft.description.trim() || "Custom page template.",
      icon: createDraft.icon,
      status: createDraft.fallback ? "published" : "draft",
      fallback: createDraft.fallback,
      defaults:
        source && createDraft.startingPoint === "duplicate"
          ? structuredClone(source.defaults)
          : { seoTitle: "", seoDescription: "" },
      preview: `/preview/${createKey}`,
      components:
        source && createDraft.startingPoint === "duplicate"
          ? structuredClone(source.components).map((component) => ({
              type: component.type,
              values: component.values,
            }))
          : [],
      revisions: [],
    };
    setSaving(true);
    try {
      await savePageTemplate({ languageId: workspace.language.id, template: definition });
      setCreateDraft(null);
      await load({ siteId: workspace.site.id, languageId: workspace.language.id });
      toast.success("Template created", {
        description: `${definition.name} is ready to edit.`,
      });
      updateSearch({ template: definition.key });
    } catch (reason) {
      toast.error("Could not create template", {
        description: reason instanceof Error ? reason.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const saveEditor = async (template: PageTemplateDefinition) => {
    if (!workspace) return;
    setSaving(true);
    try {
      await savePageTemplate({ languageId: workspace.language.id, template });
      await load({ siteId: workspace.site.id, languageId: workspace.language.id });
      if (template.key !== editingKey) updateSearch({ template: template.key });
      toast.success("Template saved", {
        description: `${template.name} is stored with a new revision.`,
      });
    } catch (reason) {
      toast.error("Could not save template", {
        description: reason instanceof Error ? reason.message : undefined,
      });
      throw reason;
    } finally {
      setSaving(false);
    }
  };
  const submitRename = async () => {
    const template = templates.find((item) => item.key === rename?.key);
    if (!template || !rename?.name.trim() || !workspace) return;
    setSaving(true);
    try {
      await savePageTemplate({
        languageId: workspace.language.id,
        template: { ...template, name: rename.name.trim() },
      });
      setRename(null);
      await load({ siteId: workspace.site.id, languageId: workspace.language.id });
      toast.success("Template renamed", { description: rename.name.trim() });
    } catch (reason) {
      toast.error("Could not rename template", {
        description: reason instanceof Error ? reason.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteKey || !workspace) return;
    const template = templates.find((item) => item.key === deleteKey);
    setSaving(true);
    try {
      if (!template?.id) throw new Error("Template not found.");
      await deletePageTemplate(workspace.language.id, template.id);
      setDeleteKey("");
      await load({ siteId: workspace.site.id, languageId: workspace.language.id });
      toast.success("Template deleted", {
        description: `${template?.name ?? "Template"} was removed. Existing pages were kept.`,
      });
    } catch (reason) {
      toast.error("Could not delete template", {
        description: reason instanceof Error ? reason.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const confirmFallback = async () => {
    if (!fallbackKey || !workspace) return;
    const template = templates.find((item) => item.key === fallbackKey);
    setSaving(true);
    try {
      if (!template?.id) throw new Error("Template not found.");
      await setFallbackPageTemplate(workspace.language.id, template.id);
      setFallbackKey("");
      await load({ siteId: workspace.site.id, languageId: workspace.language.id });
      toast.success("Fallback updated", {
        description: `${template?.name ?? "Template"} is now the site fallback.`,
      });
    } catch (reason) {
      toast.error("Could not update fallback", {
        description: reason instanceof Error ? reason.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const switchWorkspace = (option: WorkspaceOption) =>
    void load({ siteId: option.siteId, languageId: option.languageId });

  if (authLoading || !user) return <LoadingSplash />;
  if (editing && workspace) {
    return (
      <PageTemplateEditor
        initialTemplate={editing}
        key={editing.key}
        saving={saving}
        siteName={workspace.site.name}
        onBack={() => updateSearch({ q: query })}
        onSave={saveEditor}
      />
    );
  }

  return (
    <AppShell
      active="page-templates"
      languageCode={workspace?.language.code}
      languageName={workspace?.language.name}
      onWorkspaceSelect={switchWorkspace}
      pageCount={workspace?.pageCount}
      siteName={workspace?.site.name}
      workspaces={workspace?.workspaces}
    >
      <section className="sf-template-overview">
        <div className="sf-template-breadcrumb">
          <i className="ph-fill ph-wrench" /> Developer tools <i className="ph ph-caret-right" />
          <strong>Page templates</strong>
        </div>
        <header className="sf-template-overview-head">
          <div>
            <h1>
              Page templates{" "}
              <span>
                <i className="ph-fill ph-database" /> Production managed
              </span>
            </h1>
            <p>
              Copy-on-create starting points for new pages. Editing a template never changes pages
              already made from it. Stored in the workspace database with revision history.
            </p>
            <small>
              <i className="ph ph-globe-hemisphere-west" /> Site:{" "}
              <strong>{workspace?.site.name ?? "Loading..."}</strong> · templates are
              language-scoped
            </small>
          </div>
          <span className="sf-spacer" />
          <label className="sf-template-search">
            <i className="ph ph-magnifying-glass" />
            <Input
              unstyled
              value={query}
              onChange={(event) => updateSearch({ q: event.target.value })}
              placeholder="Search templates..."
            />
            {query ? (
              <button aria-label="Clear search" onClick={() => updateSearch({})} type="button">
                <i className="ph ph-x" />
              </button>
            ) : null}
          </label>
          <Button onClick={() => openCreate()} type="button">
            <i className="ph-bold ph-plus" /> New template
          </Button>
        </header>
        <div className="sf-template-overview-body sf-scroll">
          {loading ? <TemplateTableSkeleton /> : null}
          {!loading && error ? (
            <OverviewState icon="ph-plugs" title="Couldn't load page templates">
              <p>
                The template workspace could not be loaded from the database. Check your connection
                and try again.
              </p>
              <Button onClick={() => void load()}>
                <i className="ph ph-arrow-clockwise" /> Retry
              </Button>
            </OverviewState>
          ) : null}
          {!loading && !error && !templates.length ? (
            <OverviewState icon="ph-stack" title="No templates for this site yet">
              <p>
                Templates give new pages a starting set of components. Create the first one, then
                set it as the site fallback.
              </p>
              <Button onClick={() => openCreate()}>
                <i className="ph-bold ph-plus" /> New template
              </Button>
            </OverviewState>
          ) : null}
          {!loading && !error && templates.length && !filtered.length ? (
            <OverviewState icon="ph-magnifying-glass" title={`No templates match “${query}”`}>
              <p>Try a different search.</p>
              <Button onClick={() => updateSearch({})} variant="outline">
                Clear search
              </Button>
            </OverviewState>
          ) : null}
          {!loading && !error && filtered.length ? (
            <div className="sf-template-table">
              <div className="sf-template-table-head">
                <span>Template</span>
                <span>Components</span>
                <span>Pages created</span>
                <span>Last modified</span>
                <span>Role</span>
                <span />
              </div>
              {filtered.map((template) => {
                const issues = validatePageTemplate(template);
                return (
                  <div
                    className="sf-template-row"
                    key={template.key}
                    onClick={() => updateSearch({ q: query, template: template.key })}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      updateSearch({ q: query, template: template.key });
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="sf-template-name">
                      <i className={`ph ${template.icon}`} />
                      <span>
                        <strong>
                          {template.name} <b className="sf-mono">{template.key}</b>
                        </strong>
                        <small>{template.description}</small>
                      </span>
                    </span>
                    <span>
                      <strong>
                        {template.components.length}{" "}
                        {template.components.length === 1 ? "component" : "components"}
                      </strong>
                      <small>{templateComponentSummary(template) || "Empty"}</small>
                    </span>
                    <span className="sf-mono">{template.usageCount ?? 0}</span>
                    <span>
                      <strong>
                        {template.modifiedAt
                          ? new Date(template.modifiedAt).toLocaleDateString()
                          : "Not saved"}
                      </strong>
                      <small>{template.status === "published" ? "Published" : "Draft"}</small>
                    </span>
                    <span className="sf-template-role-cell">
                      {template.fallback ? (
                        <b>
                          <i className="ph-fill ph-push-pin" /> Fallback
                        </b>
                      ) : null}
                      {template.status === "draft" ? <span>Draft</span> : null}
                      {issues.length ? (
                        <em>
                          <i className="ph-fill ph-warning" /> {issues.length}{" "}
                          {issues.length === 1 ? "issue" : "issues"}
                        </em>
                      ) : null}
                    </span>
                    <Button
                      aria-label={`Actions for ${template.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuKey(menuKey === template.key ? "" : template.key);
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <i className="ph ph-dots-three-vertical" />
                    </Button>
                    {menuKey === template.key ? (
                      <div
                        className="sf-template-row-menu"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        role="menu"
                        tabIndex={-1}
                      >
                        <button
                          onClick={() => updateSearch({ q: query, template: template.key })}
                          type="button"
                        >
                          <i className="ph ph-pencil-simple" /> Edit
                        </button>
                        <button
                          onClick={() => {
                            openCreate(template);
                            setMenuKey("");
                          }}
                          type="button"
                        >
                          <i className="ph ph-copy" /> Duplicate
                        </button>
                        <button
                          onClick={() => {
                            setRename({ key: template.key, name: template.name });
                            setMenuKey("");
                          }}
                          type="button"
                        >
                          <i className="ph ph-textbox" /> Rename
                        </button>
                        <button
                          disabled={
                            template.fallback ||
                            template.status !== "published" ||
                            Boolean(issues.length)
                          }
                          onClick={() => {
                            setFallbackKey(template.key);
                            setMenuKey("");
                          }}
                          type="button"
                        >
                          <i className="ph ph-push-pin" />{" "}
                          {template.fallback ? "Is the fallback" : "Set as fallback"}
                        </button>
                        <hr />
                        <button
                          className="danger"
                          onClick={() => {
                            setDeleteKey(template.key);
                            setMenuKey("");
                          }}
                          type="button"
                        >
                          <i className="ph ph-trash" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        <footer>
          {templates.length} templates · fallback:{" "}
          <span className="sf-mono">{currentFallback?.key ?? "none"}</span>
        </footer>
      </section>

      <Modal
        className="sf-template-create-modal"
        open={Boolean(createDraft)}
        onOpenChange={(open) => !open && !saving && setCreateDraft(null)}
      >
        {createDraft ? (
          <>
            <header>
              <div>
                <ModalTitle>New page template</ModalTitle>
                <ModalDescription>
                  Create a language-scoped, copy-on-create starting point.
                </ModalDescription>
              </div>
              <ModalClose disabled={saving}>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body sf-template-create-body">
              <div className="sf-template-create-name">
                <button
                  aria-label="Change icon"
                  onClick={() =>
                    setCreateDraft({
                      ...createDraft,
                      icon: icons[(icons.indexOf(createDraft.icon) + 1) % icons.length]!,
                    })
                  }
                  type="button"
                >
                  <i className={`ph ${createDraft.icon}`} />
                </button>
                <div className="sf-template-create-field">
                  <span>Name</span>
                  <Input
                    unstyled
                    autoFocus
                    value={createDraft.name}
                    onChange={(event) =>
                      setCreateDraft({
                        ...createDraft,
                        name: event.target.value,
                        key: createDraft.keyEdited
                          ? createDraft.key
                          : slugifyTemplateKey(event.target.value),
                      })
                    }
                    placeholder="Standard page"
                  />
                </div>
              </div>
              <div className="sf-template-create-field">
                <span>Stable key</span>
                <Input
                  unstyled
                  className="sf-mono"
                  value={createDraft.key}
                  onChange={(event) =>
                    setCreateDraft({ ...createDraft, key: event.target.value, keyEdited: true })
                  }
                  placeholder="standard-page"
                />
                {createKeyError ? (
                  <em>{createKeyError}</em>
                ) : (
                  <small>Used by page preferences and origin metadata.</small>
                )}
              </div>
              <div className="sf-template-create-field">
                <span>Description</span>
                <Textarea
                  unstyled
                  value={createDraft.description}
                  onChange={(event) =>
                    setCreateDraft({ ...createDraft, description: event.target.value })
                  }
                  placeholder="What should editors use this for?"
                />
              </div>
              <fieldset>
                <legend>Starting point</legend>
                <button
                  className={createDraft.startingPoint === "empty" ? "selected" : ""}
                  onClick={() => setCreateDraft({ ...createDraft, startingPoint: "empty" })}
                  type="button"
                >
                  <i className="ph ph-file-dashed" />
                  <span>
                    <strong>Empty template</strong>
                    <small>Start with no components.</small>
                  </span>
                </button>
                <button
                  className={createDraft.startingPoint === "duplicate" ? "selected" : ""}
                  onClick={() => setCreateDraft({ ...createDraft, startingPoint: "duplicate" })}
                  type="button"
                >
                  <i className="ph ph-copy" />
                  <span>
                    <strong>Duplicate existing</strong>
                    <small>Copy another template's components.</small>
                  </span>
                </button>
              </fieldset>
              {createDraft.startingPoint === "duplicate" ? (
                <div className="sf-template-create-field">
                  <span>Template to duplicate</span>
                  <NativeSelect
                    unstyled
                    value={createDraft.duplicateKey}
                    onChange={(event) =>
                      setCreateDraft({ ...createDraft, duplicateKey: event.target.value })
                    }
                  >
                    {templates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
              <div className="sf-template-create-fallback">
                <Switch
                  checked={createDraft.fallback}
                  onCheckedChange={(checked) =>
                    setCreateDraft({ ...createDraft, fallback: checked })
                  }
                />
                <span>
                  <strong>Make language fallback</strong>
                  <small>
                    {createDraft.fallback && currentFallback
                      ? `This will replace ${currentFallback.name} as the fallback.`
                      : "Used when a page has no preferred child template."}
                  </small>
                </span>
              </div>
            </div>
            <footer>
              <ModalClose className="sf-action" disabled={saving}>
                Cancel
              </ModalClose>
              <Button
                disabled={!createDraft.name.trim() || !createKey || Boolean(createKeyError)}
                loading={saving}
                onClick={() => void submitCreate()}
              >
                Create template
              </Button>
            </footer>
          </>
        ) : null}
      </Modal>

      <Modal open={Boolean(rename)} onOpenChange={(open) => !open && !saving && setRename(null)}>
        {rename ? (
          <>
            <header>
              <div>
                <ModalTitle>Rename template</ModalTitle>
                <ModalDescription>The stable key will stay the same.</ModalDescription>
              </div>
              <ModalClose>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body">
              <div className="sf-template-create-field">
                <span>Name</span>
                <Input
                  unstyled
                  autoFocus
                  value={rename.name}
                  onChange={(event) => setRename({ ...rename, name: event.target.value })}
                />
              </div>
            </div>
            <footer>
              <ModalClose className="sf-action">Cancel</ModalClose>
              <Button loading={saving} onClick={() => void submitRename()}>
                Rename
              </Button>
            </footer>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteKey)}
        onOpenChange={(open) => !open && !saving && setDeleteKey("")}
      >
        {deleteKey
          ? (() => {
              const template = templates.find((item) => item.key === deleteKey);
              const blocked = Boolean(template?.fallback);
              return (
                <>
                  <header>
                    <div>
                      <ModalTitle>
                        {blocked ? "Choose another fallback first" : "Delete template?"}
                      </ModalTitle>
                      <ModalDescription>{template?.name}</ModalDescription>
                    </div>
                    <ModalClose>
                      <i className="ph ph-x" />
                    </ModalClose>
                  </header>
                  <div className="sf-overview-modal-body">
                    <p>
                      {blocked
                        ? "Every language must have one fallback template. Set another template as fallback before deleting this one."
                        : `This removes the template definition. The ${templates.find((item) => item.key === deleteKey)?.usageCount ?? 0} pages created from it will not be deleted or changed.`}
                    </p>
                    {!blocked ? (
                      <div className="sf-template-pages-safe">
                        <i className="ph ph-shield-check" />
                        <span>
                          <strong>Existing pages are safe</strong>They remain fully independent.
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <footer>
                    <ModalClose className="sf-action">Cancel</ModalClose>
                    {blocked ? (
                      <Button
                        onClick={() => {
                          setDeleteKey("");
                        }}
                        variant="outline"
                      >
                        Choose fallback
                      </Button>
                    ) : (
                      <Button
                        loading={saving}
                        onClick={() => void confirmDelete()}
                        variant="destructive"
                      >
                        Delete template
                      </Button>
                    )}
                  </footer>
                </>
              );
            })()
          : null}
      </Modal>

      <Modal
        open={Boolean(fallbackKey)}
        onOpenChange={(open) => !open && !saving && setFallbackKey("")}
      >
        {fallbackKey ? (
          <>
            <header>
              <div>
                <ModalTitle>Replace site fallback?</ModalTitle>
                <ModalDescription>Exactly one fallback is required.</ModalDescription>
              </div>
              <ModalClose>
                <i className="ph ph-x" />
              </ModalClose>
            </header>
            <div className="sf-overview-modal-body">
              <p>
                <strong>{templates.find((item) => item.key === fallbackKey)?.name}</strong> will
                replace <strong>{currentFallback?.name}</strong> as the fallback for new child
                pages.
              </p>
            </div>
            <footer>
              <ModalClose className="sf-action">Cancel</ModalClose>
              <Button loading={saving} onClick={() => void confirmFallback()}>
                Replace fallback
              </Button>
            </footer>
          </>
        ) : null}
      </Modal>
    </AppShell>
  );
}

function OverviewState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sf-template-overview-state">
      <i className={`ph ${icon}`} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

function TemplateTableSkeleton() {
  return (
    <div className="sf-template-skeleton">
      <div className="sf-template-table-head">
        {Array.from({ length: 6 }, (_, index) => (
          <span className="sf-shimmer" key={index} />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index}>
          {Array.from({ length: 6 }, (_, cell) => (
            <span className="sf-shimmer" key={cell} />
          ))}
        </div>
      ))}
    </div>
  );
}
