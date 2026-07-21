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
  onBack: () => void;
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
  onBack,
  onSelectTab,
  onSave,
}: EditorToolbarProps) {
  return (
    <header className="sf-editor-top [display:flex] [height:56px] [flex:none] [align-items:center] [gap:12px] bg-surface [padding:0_16px] [border-bottom:1px_solid_var(--sf-border)] max-[760px]:[gap:7px] dark:[border-color:#323841] dark:[background:#1d2126] [&_.sf-action]:[height:34px] [&_.sf-action:disabled]:[opacity:0.55] max-[760px]:[&_.sf-action:not(.primary)]:[display:none] max-[760px]:[&_.sf-editor-location]:[display:none] max-[760px]:[&_.sf-editor-status]:[display:none]">
      <Button
        unstyled
        className="sf-editor-tree [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_11px] [font-size:13px] [font-weight:600] [color:#33474a] [border:1px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126]"
        onClick={onBack}
      >
        <i className="ph-bold ph-arrow-left" />
        Tree
      </Button>
      <div className="sf-editor-location [display:flex] [min-width:0] [flex-direction:column] [gap:1px] [&_.current]:[font-weight:600] [&_.current]:[color:#33474a] dark:[&_.current]:[color:#a7aeb8] [&_i]:[font-size:10px] [&>b]:[white-space:nowrap] [&>b]:text-action [&>b]:[font:500_12px_'Geist_Mono'] dark:[&>b]:[color:#b994f8] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:6px] [&>div]:[font-size:12px] [&>div]:text-ink-subtle max-[1000px]:[&>div]:[display:none] [&>div>span]:[display:flex] [&>div>span]:[align-items:center] [&>div>span]:[gap:6px]">
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
        className={`sf-editor-status [display:inline-flex] [height:22px] [align-items:center] [gap:5px] [border-radius:5px] [padding:0_8px] [font-size:11.5px] [font-weight:600] [border:0] [&.concept]:bg-concept-soft [&.concept]:text-concept [&.published]:bg-published-soft [&.published]:text-published [&>i]:[height:5px] [&>i]:[width:5px] [&>i]:[border-radius:50%] [&>i]:[background:currentColor] ${page.status}`}
      >
        <i />
        {page.status === "published" ? "Published" : "Concept"}
      </span>
      {problems.length > 0 && (
        <Button
          unstyled
          className="sf-editor-problems [display:inline-flex] [height:22px] [cursor:pointer] [align-items:center] [gap:5px] [border-radius:5px] bg-concept-soft [padding:0_8px] [font-size:11.5px] [font-weight:600] text-concept [border:0] max-[1000px]:[display:none]"
          onClick={() => onSelectTab("seo")}
        >
          <i className="ph-fill ph-warning" />
          {problems.length} {problems.length === 1 ? "problem" : "problems"}
        </Button>
      )}
      <span className="sf-spacer [flex:1]" />
      <span className="sf-editor-saved [display:inline-flex] [align-items:center] [gap:6px] [font-size:12px] text-ink-subtle max-[1000px]:[display:none] [&_.ph-spinner]:[animation:sf-editor-spin_0.8s_linear_infinite] [&_.ph-spinner]:text-ink-subtle [&_i]:[font-size:14px] [&_i]:[color:#1f9d57]">
        <i
          className={`ph ${saving ? "ph-spinner" : savedLabel === "Save failed" ? "ph-warning-circle" : "ph-cloud-check"}`}
        />
        {savedLabel}
      </span>
      <Button
        unstyled
        className="sf-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
        disabled={saving}
        loading={savingAction === "concept"}
        onClick={() => onSave(false)}
      >
        <i className="ph ph-floppy-disk" />
        Save concept
      </Button>
      <Button
        unstyled
        className="sf-action primary [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sf-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
        disabled={saving}
        loading={savingAction === "publish"}
        onClick={() => onSave(true)}
      >
        <i className="ph-bold ph-rocket-launch" />
        {page.status === "published" ? "Publish changes" : "Publish"}
      </Button>
    </header>
  );
}
