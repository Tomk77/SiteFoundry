import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LoadingSplash } from "@/components/loading";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "@/components/modal";
import { PageTemplateEditor } from "@/features/page-templates/page-template-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  slugifyTemplateKey,
  templateComponentSummary,
  validatePageTemplate,
  type PageTemplateDefinition,
} from "@/lib/page-templates";
import {
  deletePageTemplate,
  loadPageTemplateWorkspace,
  savePageTemplate,
  setFallbackPageTemplate,
  type PageTemplateWorkspace,
} from "@/lib/page-templates-data";
import type { WorkspaceOption } from "@/lib/page-tree";

export interface PageTemplatesSearch {
  q?: string;
  template?: string;
}

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

export function PageTemplatesScreen({ search }: { search: PageTemplatesSearch }) {
  const navigate = useNavigate({ from: "/page-templates" });
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
      <section className="sf-template-overview [display:flex] [height:100vh] [min-width:0] [flex-direction:column] bg-surface text-ink [&>footer]:[height:36px] [&>footer]:[padding:10px_22px] [&>footer]:[font-size:11.5px] [&>footer]:text-ink-subtle [&>footer]:[border-top:1px_solid_var(--sf-border)]">
        <div className="sf-template-breadcrumb [display:flex] [align-items:center] [gap:8px] [padding:12px_22px_0] [font-size:12px] text-ink-subtle [&_.ph-caret-right]:[font-size:10px] [&_strong]:text-ink [&>i:first-child]:[color:#d18f0c]">
          <i className="ph-fill ph-wrench" /> Developer tools <i className="ph ph-caret-right" />
          <strong>Page templates</strong>
        </div>
        <header className="sf-template-overview-head [display:flex] [align-items:flex-start] [gap:14px] [padding:14px_22px_15px] [border-bottom:1px_solid_var(--sf-sunken)] [&_h1]:[margin:0] [&_h1]:[display:flex] [&_h1]:[align-items:center] [&_h1]:[gap:10px] [&_h1]:[font-size:19px] [&_h1]:[letter-spacing:-0.015em] [&_h1>span]:[display:inline-flex] [&_h1>span]:[height:21px] [&_h1>span]:[align-items:center] [&_h1>span]:[gap:5px] [&_h1>span]:[border-radius:5px] [&_h1>span]:bg-concept-soft [&_h1>span]:[padding:0_8px] [&_h1>span]:[font-size:11px] [&_h1>span]:text-concept dark:[&_h1>span]:[color:#e1b444] dark:[&_h1>span]:[background:#312813] [&_p]:[margin:4px_0] [&_p]:[max-width:640px] [&_p]:[font-size:12.5px] [&_p]:[line-height:1.5] [&_p]:text-ink-muted [&_small]:[display:inline-flex] [&_small]:[align-items:center] [&_small]:[gap:5px] [&_small]:[font-size:12px] [&_small]:text-ink-subtle [&_small_strong]:text-ink [&>div:first-child]:[min-width:0]">
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
          <span className="sf-spacer [flex:1]" />
          <label className="sf-template-search [display:flex] [height:36px] [width:230px] [flex:none] [align-items:center] [gap:8px] [border-radius:8px] bg-surface [padding:0_12px] [border:1.5px_solid_var(--sf-field)] [transition:border-color_0.12s,_box-shadow_0.12s] dark:[border-color:#3d444e] [&_button]:[display:grid] [&_button]:[height:22px] [&_button]:[width:22px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[padding:0] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&>i]:text-ink-subtle">
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
        <div className="sf-template-overview-body sf-scroll [min-height:0] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
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
            <div className="sf-template-table [min-width:940px]">
              <div className="sf-template-table-head [position:sticky] [top:0] [z-index:2] [display:grid] [grid-template-columns:minmax(300px,_2fr)_172px_120px_150px_130px_44px] [align-items:center] [gap:16px] bg-surface [padding:9px_22px] [font-size:10.5px] [font-weight:600] [letter-spacing:0.06em] text-ink-subtle [text-transform:uppercase] [border-bottom:1px_solid_var(--sf-border)]">
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
                    className="sf-template-row [position:relative] [display:grid] [cursor:pointer] [grid-template-columns:minmax(300px,_2fr)_172px_120px_150px_130px_44px] [align-items:center] [gap:16px] [padding:13px_22px] [border-bottom:1px_solid_var(--sf-sunken)] [&:hover]:bg-canvas [&>span:not(.sf-template-name)]:[display:flex] [&>span:not(.sf-template-name)]:[min-width:0] [&>span:not(.sf-template-name)]:[flex-direction:column] [&>span:not(.sf-template-name)]:[gap:3px] [&>span:not(.sf-template-name)]:[font-size:12.5px] [&>span:not(.sf-template-name)]:text-ink-muted [&>span>small]:[overflow:hidden] [&>span>small]:[font-size:11px] [&>span>small]:[text-overflow:ellipsis] [&>span>small]:[white-space:nowrap] [&>span>small]:text-ink-subtle [&>span>strong]:[overflow:hidden] [&>span>strong]:[font-size:12.5px] [&>span>strong]:[text-overflow:ellipsis] [&>span>strong]:[white-space:nowrap] [&>span>strong]:text-ink"
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
                    <span className="sf-template-name [display:flex] [min-width:0] [align-items:center] [gap:12px] [&_small]:[max-width:430px] [&_small]:[overflow:hidden] [&_small]:[font-size:12px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:text-ink-subtle [&_strong]:[overflow:hidden] [&_strong]:[font-size:13.5px] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [&_strong]:text-ink [&_strong_b]:[margin-left:7px] [&_strong_b]:[border-radius:4px] [&_strong_b]:bg-sunken [&_strong_b]:[padding:1px_6px] [&_strong_b]:[font-size:11px] [&_strong_b]:[font-weight:500] [&_strong_b]:text-ink-subtle [&>i]:[display:grid] [&>i]:[height:34px] [&>i]:[width:34px] [&>i]:[flex:none] [&>i]:[place-items:center] [&>i]:[border-radius:8px] [&>i]:bg-selection [&>i]:[font-size:18px] [&>i]:text-action [&>span]:[display:flex] [&>span]:[min-width:0] [&>span]:[flex-direction:column] [&>span]:[gap:2px]">
                      <i className={`ph ${template.icon}`} />
                      <span>
                        <strong>
                          {template.name}{" "}
                          <b className="sf-mono [font-family:'Geist_Mono',_monospace]">
                            {template.key}
                          </b>
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
                    <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
                      {template.usageCount ?? 0}
                    </span>
                    <span>
                      <strong>
                        {template.modifiedAt
                          ? new Date(template.modifiedAt).toLocaleDateString()
                          : "Not saved"}
                      </strong>
                      <small>{template.status === "published" ? "Published" : "Draft"}</small>
                    </span>
                    <span className="sf-template-role-cell !flex-row [flex-wrap:wrap] [&_b]:[display:inline-flex] [&_b]:[height:21px] [&_b]:[align-items:center] [&_b]:[gap:4px] [&_b]:[border-radius:5px] [&_b]:[padding:0_7px] [&_b]:[font-size:11px] [&_b]:[font-weight:600] [&_b]:[white-space:nowrap] [&_b]:[color:#33474a] [&_b]:[font-style:normal] [&_b]:[background:#dfe3e8] dark:[&_b]:[color:#c5cdd6] dark:[&_b]:[background:#333b44] [&_em]:[display:inline-flex] [&_em]:[height:21px] [&_em]:[align-items:center] [&_em]:[gap:4px] [&_em]:[border-radius:5px] [&_em]:bg-concept-soft [&_em]:[padding:0_7px] [&_em]:[font-size:11px] [&_em]:[font-weight:600] [&_em]:[white-space:nowrap] [&_em]:text-concept [&_em]:[font-style:normal] dark:[&_em]:[color:#e1b444] dark:[&_em]:[background:#312813] [&>span]:[display:inline-flex] [&>span]:[height:21px] [&>span]:[align-items:center] [&>span]:[gap:4px] [&>span]:[border-radius:5px] [&>span]:bg-sunken [&>span]:[padding:0_7px] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[white-space:nowrap] [&>span]:[color:var(--sf-muted)] [&>span]:[font-style:normal] dark:[&>span]:[color:#c5cdd6] dark:[&>span]:[background:#333b44]">
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
                        className="sf-template-row-menu [position:absolute] [top:48px] [right:22px] [z-index:15] [display:flex] [width:210px] [animation:sf-template-pop_0.13s_ease] [flex-direction:column] [border-radius:10px] bg-surface [padding:5px] [box-shadow:0_12px_32px_rgb(23_35_38_/_18%)] [border:1px_solid_var(--sf-border)] [&_button]:[display:flex] [&_button]:[height:34px] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:9px] [&_button]:[border-radius:7px] [&_button]:[padding:0_9px] [&_button]:[text-align:left] [&_button]:[font-size:12.5px] [&_button]:text-ink [&_button]:[background:transparent] [&_button]:[border:0] [&_button.danger]:text-danger [&_button.danger:hover]:bg-danger-soft [&_button:disabled]:[cursor:default] [&_button:disabled]:[opacity:0.55] [&_button:hover]:bg-sunken [&_hr]:[margin:4px_0] [&_hr]:[width:100%] [&_hr]:[border-top:1px_solid_var(--sf-border)] [&_hr]:[border:0]"
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
          <span className="sf-mono [font-family:'Geist_Mono',_monospace]">
            {currentFallback?.key ?? "none"}
          </span>
        </footer>
      </section>

      <Modal
        className="sf-template-create-modal [width:min(610px,_calc(100vw_-_40px))]"
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
            <div className="sf-overview-modal-body sf-template-create-body [max-height:70vh] [overflow:auto] [&_em]:[font-size:11.5px] [&_em]:text-danger [&_em]:[font-style:normal] [&_fieldset]:[margin:0] [&_fieldset]:[display:grid] [&_fieldset]:[grid-template-columns:1fr_1fr] [&_fieldset]:[gap:9px] [&_fieldset]:[padding:0] [&_fieldset]:[border:0] [&_fieldset_button]:[display:flex] [&_fieldset_button]:[cursor:pointer] [&_fieldset_button]:[align-items:center] [&_fieldset_button]:[gap:10px] [&_fieldset_button]:[border-radius:9px] [&_fieldset_button]:bg-surface [&_fieldset_button]:[padding:11px] [&_fieldset_button]:[text-align:left] [&_fieldset_button]:text-ink [&_fieldset_button]:[border:1.5px_solid_var(--sf-border)] [&_fieldset_button.selected]:border-action [&_fieldset_button.selected]:bg-action-soft [&_fieldset_button>i]:[font-size:20px] [&_fieldset_button>i]:text-action [&_fieldset_button>span]:[display:flex] [&_fieldset_button>span]:[flex-direction:column] [&_fieldset_button>span]:[gap:2px] [&_fieldset_legend]:[grid-column:1_/_-1] [&_fieldset_legend]:[margin-bottom:2px] [&_fieldset_legend]:[display:flex] [&_fieldset_legend]:[align-items:center] [&_fieldset_legend]:[gap:6px] [&_fieldset_legend]:[font-size:11px] [&_fieldset_legend]:[font-weight:600] [&_fieldset_legend]:[letter-spacing:0.04em] [&_fieldset_legend]:text-ink-subtle [&_fieldset_legend]:[text-transform:uppercase] [&_fieldset_small]:[font-size:11px] [&_fieldset_small]:text-ink-subtle [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:8px_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:8px_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)] [&_textarea]:[width:100%] [&_textarea]:[border-radius:8px] [&_textarea]:bg-surface [&_textarea]:[padding:8px_10px] [&_textarea]:[font-size:13px] [&_textarea]:text-ink [&_textarea]:[outline:0] [&_textarea]:[border:1.5px_solid_var(--sf-field)] dark:[&_textarea]:[border-color:#3d444e] [&_textarea:focus]:border-action [&_textarea:focus]:[box-shadow:0_0_0_3px_var(--sf-focus-ring)]">
              <div className="sf-template-create-name [display:grid] [grid-template-columns:48px_1fr] [align-items:end] [gap:10px] [&>button]:[display:grid] [&>button]:[height:38px] [&>button]:[width:48px] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:8px] [&>button]:bg-selection [&>button]:[font-size:19px] [&>button]:text-action [&>button]:[border:1px_solid_var(--sf-border)]">
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
                <div className="sf-template-create-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
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
              <div className="sf-template-create-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
                <span>Stable key</span>
                <Input
                  unstyled
                  className="sf-mono [font-family:'Geist_Mono',_monospace]"
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
              <div className="sf-template-create-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
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
                <div className="sf-template-create-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
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
              <div className="sf-template-create-fallback [display:flex] [align-items:center] [gap:10px] [font-size:12.5px] text-ink-muted [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>span]:[display:flex] [&>span]:[flex-direction:column] [&>span]:[gap:2px]">
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
              <ModalClose
                className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={saving}
              >
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
              <div className="sf-template-create-field [display:flex] [flex-direction:column] [gap:5px] [&>small]:[margin:0] [&>small]:[font-size:11px] [&>small]:[line-height:1.4] [&>small]:text-ink-subtle [&>span:first-child]:[display:flex] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:6px] [&>span:first-child]:[font-size:11px] [&>span:first-child]:[font-weight:600] [&>span:first-child]:[letter-spacing:0.04em] [&>span:first-child]:text-ink-subtle [&>span:first-child]:[text-transform:uppercase]">
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
              <ModalClose className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]">
                Cancel
              </ModalClose>
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
                      <div className="sf-template-pages-safe [display:flex] [align-items:flex-start] [gap:10px] [border-radius:10px] [padding:12px] text-published [background:#eef8f2] [border:1px_solid_#b8dec9] dark:[border-color:#28533f] dark:[color:#54be88] dark:[background:#18302a] [&>i]:[font-size:18px] [&>span]:[display:flex] [&>span]:[flex-direction:column] [&>span]:[gap:2px] [&>span]:[font-size:12px] [&>span]:[line-height:1.45]">
                        <i className="ph ph-shield-check" />
                        <span>
                          <strong>Existing pages are safe</strong>They remain fully independent.
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <footer>
                    <ModalClose className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]">
                      Cancel
                    </ModalClose>
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
              <ModalClose className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:[border-color:#eec6bc] [&.danger]:bg-surface [&.danger]:text-danger [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]">
                Cancel
              </ModalClose>
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
    <div className="sf-template-overview-state [display:flex] [min-height:420px] [flex-direction:column] [align-items:center] [justify-content:center] [gap:12px] [padding:40px] [text-align:center] [&_p]:[margin:-4px_0_4px] [&_p]:[max-width:440px] [&_p]:[font-size:13.5px] [&_p]:[line-height:1.55] [&_p]:text-ink-muted [&>i]:[display:grid] [&>i]:[height:60px] [&>i]:[width:60px] [&>i]:[place-items:center] [&>i]:[border-radius:15px] [&>i]:bg-selection [&>i]:[font-size:28px] [&>i]:text-action [&>strong]:[font-size:16px]">
      <i className={`ph ${icon}`} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

function TemplateTableSkeleton() {
  return (
    <div className="sf-template-skeleton [padding:0_22px] [&_.sf-shimmer]:[display:block] [&_.sf-shimmer]:[height:11px] [&_.sf-shimmer]:[width:70%] [&>div:not(.sf-template-table-head)]:[display:grid] [&>div:not(.sf-template-table-head)]:[grid-template-columns:minmax(300px,_2fr)_172px_120px_150px_130px_44px] [&>div:not(.sf-template-table-head)]:[align-items:center] [&>div:not(.sf-template-table-head)]:[gap:16px] [&>div:not(.sf-template-table-head)]:[padding:15px_0] [&>div:not(.sf-template-table-head)]:[border-bottom:1px_solid_var(--sf-sunken)]">
      <div className="sf-template-table-head [position:sticky] [top:0] [z-index:2] [display:grid] [grid-template-columns:minmax(300px,_2fr)_172px_120px_150px_130px_44px] [align-items:center] [gap:16px] bg-surface [padding:9px_22px] [font-size:10.5px] [font-weight:600] [letter-spacing:0.06em] text-ink-subtle [text-transform:uppercase] [border-bottom:1px_solid_var(--sf-border)]">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            className="sf-shimmer [display:block] [flex:none] [animation:sf-loading-shimmer_1.35s_linear_infinite] [border-radius:5px] [background-image:linear-gradient(_90deg,_var(--sf-skeleton)_0,_var(--sf-skeleton-highlight)_44px,_var(--sf-skeleton)_88px_)] [background-size:600px_100%] motion-reduce:[animation:none] [&.invisible]:[visibility:hidden] [&.round]:[border-radius:999px]"
            key={index}
          />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index}>
          {Array.from({ length: 6 }, (_, cell) => (
            <span
              className="sf-shimmer [display:block] [flex:none] [animation:sf-loading-shimmer_1.35s_linear_infinite] [border-radius:5px] [background-image:linear-gradient(_90deg,_var(--sf-skeleton)_0,_var(--sf-skeleton-highlight)_44px,_var(--sf-skeleton)_88px_)] [background-size:600px_100%] motion-reduce:[animation:none] [&.invisible]:[visibility:hidden] [&.round]:[border-radius:999px]"
              key={cell}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
