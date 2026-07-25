import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { EditablePage } from "@/lib/page-editor";
import { validatePageTemplate, type PageTemplateDefinition } from "@/lib/page-templates";

interface SettingsTabProps {
  page: EditablePage;
  path: string;
  availableTemplates: PageTemplateDefinition[];
  onChange: (changes: Partial<EditablePage>) => void;
  onDeleteRequest: () => void;
  onShowToast: (message: string) => void;
}

export function SettingsTab({
  page,
  path,
  availableTemplates,
  onChange,
  onDeleteRequest,
  onShowToast,
}: SettingsTabProps) {
  return (
    <div className="sc-editor-form settings [display:flex] [flex-direction:column] [gap:16px] [&.settings]:[gap:18px]">
      <label className="sc-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
        <span>Slug</span>
        <div className="sc-slug [display:flex] [align-items:center] [overflow:hidden] [border-radius:8px] bg-surface [border:1.5px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_b]:[padding-left:10px] [&_b]:[color:#aebab6] [&_b]:[font:400_13px_'Geist_Mono'] [&_input]:[min-width:0] [&_input]:[flex:1] [&_input]:[padding:9px_10px_9px_2px] [&_input]:[outline:0] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[font:13px_'Geist_Mono'] dark:[&_input]:[color:#e9ecf1] [&:focus-within]:border-action [&:focus-within]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)]">
          <b>{page.parentPath}</b>
          <Input
            unstyled
            value={page.slug}
            onChange={(event) =>
              onChange({
                slug: event.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
              })
            }
          />
        </div>
        {path !== page.path && (
          <em>
            <i className="ph-fill ph-warning" />
            Changing the slug updates this URL and creates a redirect from the old one.
          </em>
        )}
      </label>
      <dl className="sc-page-meta [margin:0] [display:flex] [flex-direction:column] [gap:8px] [border-radius:10px] [padding:13px] [background:#fafcfa] [border:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[color:#e9ecf1] dark:[background:#242930] [&_dd]:[margin:0] [&_dd]:[font-weight:500] [&_dd]:text-ink dark:[&_dd]:[color:#e9ecf1] [&_div]:[display:flex] [&_div]:[align-items:center] [&_div]:[gap:10px] [&_div]:[font-size:12.5px] [&_dt]:[width:130px] [&_dt]:[flex:none] [&_dt]:text-ink-subtle dark:[&_dt]:[color:#79808b]">
        <div>
          <dt>Parent</dt>
          <dd>
            {page.parentTitle || "Root"} ({page.parentPath})
          </dd>
        </div>
        <div>
          <dt>From template</dt>
          <dd>{page.templateName}</dd>
        </div>
        <div>
          <dt>Last published</dt>
          <dd>
            {page.publishedRevision
              ? new Date(page.publishedRevision.publishedAt).toLocaleDateString()
              : "Not yet published"}
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(page.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
      <label className="sc-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
        <span>Preferred child template</span>
        <NativeSelect
          unstyled
          className="sc-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
          value={page.preferredChildTemplate || ""}
          onChange={(event) => onChange({ preferredChildTemplate: event.target.value || null })}
        >
          <option value="">
            Use site fallback
            {availableTemplates.find((template) => template.fallback)
              ? ` (${availableTemplates.find((template) => template.fallback)?.name})`
              : ""}
          </option>
          {page.preferredChildTemplate &&
          !availableTemplates.some((template) => template.key === page.preferredChildTemplate) ? (
            <option disabled value={page.preferredChildTemplate}>
              Unavailable template ({page.preferredChildTemplate})
            </option>
          ) : null}
          {availableTemplates.map((template) => (
            <option
              disabled={
                template.status !== "published" || Boolean(validatePageTemplate(template).length)
              }
              key={template.key}
              value={template.key}
            >
              {template.name}
              {template.status !== "published" || validatePageTemplate(template).length
                ? " (unavailable)"
                : ""}
            </option>
          ))}
        </NativeSelect>
        <p>Suggested first when adding a child page here.</p>
      </label>
      <div className="sc-translations [display:flex] [flex-direction:column] [gap:8px] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:text-action [&_button]:[background:transparent] [&_button]:[border:0] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:10px] [&>div]:[border-radius:9px] [&>div]:[padding:9px_11px] [&>div]:[border:1px_solid_var(--sc-border)] dark:[&>div]:[border-color:#3d444e] dark:[&>div]:[color:#e9ecf1] dark:[&>div]:[background:#1d2126] [&>div>b]:[display:grid] [&>div>b]:[height:20px] [&>div>b]:[width:26px] [&>div>b]:[place-items:center] [&>div>b]:[border-radius:4px] [&>div>b]:bg-sunken [&>div>b]:text-ink-muted [&>div>b]:[font:700_10px_'Geist_Mono'] [&>div>i]:[color:#1f9d57] [&>div>span]:[flex:1] [&>div>span]:[overflow:hidden] [&>div>span]:[font-size:13px] [&>div>span]:[text-overflow:ellipsis] [&>div>span]:[white-space:nowrap] dark:[&>div>span]:[color:#e9ecf1] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
        <span>Translations</span>
        <div>
          <b>EN</b>
          <span>This page (English)</span>
          <i className="ph-fill ph-link-simple" />
        </div>
        <div>
          <b>NL</b>
          <span>Productlancering</span>
          <i className="ph-fill ph-link-simple" />
        </div>
        <div>
          <b>FR</b>
          <span>Not translated yet</span>
          <Button
            unstyled
            onClick={() => onShowToast("Translation creation will be connected later")}
          >
            Create
          </Button>
        </div>
      </div>
      <div className="sc-danger [display:flex] [flex-direction:column] [gap:10px] [padding-top:16px] [border-top:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] [&>button]:[display:inline-flex] [&>button]:[height:38px] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[justify-content:center] [&>button]:[gap:7px] [&>button]:[border-radius:8px] [&>button]:bg-danger-soft [&>button]:[font-size:13px] [&>button]:[font-weight:600] [&>button]:text-danger [&>button]:[border:1px_solid_#eec6bc] dark:[&>button]:[border-color:#723c37] dark:[&>button]:[color:#f0857a] dark:[&>button]:[background:#321f1e] [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:text-danger [&>span]:[text-transform:uppercase]">
        <span>Danger zone</span>
        <Button unstyled onClick={onDeleteRequest}>
          <i className="ph ph-trash" />
          Delete this page
        </Button>
      </div>
    </div>
  );
}
