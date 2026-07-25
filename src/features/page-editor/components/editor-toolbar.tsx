import { Button } from "@/components/ui/button";
import type { EditablePage } from "@/lib/page-editor";

import type { Tab } from "../editor-model";

interface EditorToolbarProps {
  page: EditablePage;
  path: string;
  problems: string[];
  saving: boolean;
  savingAction: "concept" | "publish" | "delete" | null;
  savedLabel: string;
  changeCount: number;
  viewingPublished: boolean;
  onBack: () => void;
  onViewChange: (view: "concept" | "published") => void;
  onSelectTab: (tab: Tab) => void;
  onSave: (publish: boolean) => void;
}

export function EditorToolbar({
  page,
  path,
  problems,
  saving,
  savingAction,
  savedLabel,
  changeCount,
  viewingPublished,
  onBack,
  onViewChange,
  onSelectTab,
  onSave,
}: EditorToolbarProps) {
  return (
    <header className="sc-editor-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sc-border)] max-[760px]:[gap:7px] dark:[border-color:#323841] dark:[background:#1d2126] [&_.sc-action]:[height:34px] [&_.sc-action:disabled]:[opacity:0.55] max-[760px]:[&_.sc-action:not(.primary)]:[display:none] max-[760px]:[&_.sc-editor-location]:[display:none] max-[760px]:[&_.sc-editor-status]:[display:none]">
      <Button
        unstyled
        className="sc-editor-tree [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126]"
        onClick={onBack}
      >
        <i className="ph-bold ph-arrow-left" />
        Tree
      </Button>
      <div className="sc-editor-location [display:flex] [min-width:0] [flex-direction:column] [gap:1px] [&_.current]:[font-weight:600] [&_.current]:[color:#33474a] dark:[&_.current]:[color:#a7aeb8] [&_i]:[font-size:10px] [&>b]:[white-space:nowrap] [&>b]:text-action [&>b]:[font:500_12px_'Geist_Mono'] dark:[&>b]:[color:#b994f8] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:6px] [&>div]:[font-size:12px] [&>div]:text-ink-subtle max-[1000px]:[&>div]:[display:none] [&>div>span]:[display:flex] [&>div>span]:[align-items:center] [&>div>span]:[gap:6px]">
        <div>
          {page.breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}>
              {index > 0 && <i className="ph ph-caret-right" />}
              <span className={index === page.breadcrumbs.length - 1 ? "current" : ""}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
        <b>{path}</b>
      </div>
      <span
        className={`sc-editor-status [display:inline-flex] [height:22px] [align-items:center] [gap:5px] [border-radius:5px] [padding:0_8px] [font-size:11.5px] [font-weight:600] [border:0] [&.concept]:bg-concept-soft [&.concept]:text-concept [&.published]:bg-published-soft [&.published]:text-published [&>i]:[height:5px] [&>i]:[width:5px] [&>i]:[border-radius:50%] [&>i]:[background:currentColor] ${page.status}`}
      >
        <i />
        {page.status === "published" ? "Published" : "Concept"}
      </span>
      {problems.length > 0 && (
        <Button
          unstyled
          className="sc-editor-problems [display:inline-flex] [height:22px] [cursor:pointer] [align-items:center] [gap:5px] [border-radius:5px] bg-concept-soft [padding:0_8px] [font-size:11.5px] [font-weight:600] text-concept [border:0] max-[1000px]:[display:none]"
          onClick={() => onSelectTab("seo")}
        >
          <i className="ph-fill ph-warning" />
          {problems.length} {problems.length === 1 ? "problem" : "problems"}
        </Button>
      )}
      <span className="sc-spacer [flex:1]" />
      <div className="sc-version-switch [display:flex] [align-items:center] [gap:2px] [border-radius:8px] [padding:2px] [background:#eef1ed] dark:[background:#15181c] [&_button]:[display:inline-flex] [&_button]:[height:28px] [&_button]:[align-items:center] [&_button]:[gap:5px] [&_button]:[border-radius:6px] [&_button]:[padding:0_9px] [&_button]:[font-size:12.5px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.14)] [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.45]">
        <Button
          unstyled
          className={viewingPublished ? "" : "active"}
          title="Concept — editable version"
          onClick={() => onViewChange("concept")}
        >
          <i className="ph ph-pencil-simple-line" />
          {!viewingPublished && "Concept"}
          {changeCount > 0 && (
            <span
              className="[height:6px] [width:6px] [border-radius:999px] [background:#d18f0c]"
              title="Unpublished changes"
            />
          )}
        </Button>
        <Button
          unstyled
          className={viewingPublished ? "active" : ""}
          disabled={!page.publishedRevision}
          title={page.publishedRevision ? "Published — live, read-only" : "Not published yet"}
          onClick={() => onViewChange("published")}
        >
          <i className="ph ph-globe-simple" />
          {viewingPublished && "Published"}
        </Button>
      </div>
      <span className="sc-editor-saved [display:inline-flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle max-[1000px]:[display:none] [&_.ph-spinner]:[animation:sc-editor-spin_0.8s_linear_infinite] [&_.ph-spinner]:text-ink-subtle [&_i]:[font-size:14px] [&_i]:[color:#1f9d57]">
        <i
          className={`ph ${saving ? "ph-spinner" : savedLabel === "Save failed" ? "ph-warning-circle" : "ph-cloud-check"}`}
        />
        {savedLabel}
      </span>
      <Button
        unstyled
        className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
        disabled={saving || viewingPublished}
        loading={savingAction === "concept"}
        onClick={() => onSave(false)}
      >
        <i className="ph ph-floppy-disk" />
        Save concept
      </Button>
      <Button
        unstyled
        className="sc-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
        disabled={
          saving || viewingPublished || Boolean(page.publishedRevision && changeCount === 0)
        }
        loading={savingAction === "publish"}
        onClick={() => onSave(true)}
      >
        <i className="ph-bold ph-rocket-launch" />
        {page.publishedRevision ? "Publish concept" : "Publish"}
      </Button>
    </header>
  );
}
