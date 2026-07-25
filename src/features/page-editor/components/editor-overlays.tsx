import { Button } from "@/components/ui/button";

interface EditorOverlaysProps {
  toast: string;
  deleteOpen: boolean;
  saving: boolean;
  savingAction: "concept" | "publish" | "delete" | null;
  onCloseDelete: () => void;
  onDelete: () => void;
}

export function EditorOverlays({
  toast,
  deleteOpen,
  saving,
  savingAction,
  onCloseDelete,
  onDelete,
}: EditorOverlaysProps) {
  return (
    <>
      {toast && (
        <div className="sc-editor-toast [position:fixed] [bottom:26px] [left:50%] [z-index:70] [display:flex] [animation:sc-editor-toast_0.2s_cubic-bezier(0.2,_0.8,_0.2,_1)] [align-items:center] [gap:11px] [border-radius:11px] [padding:12px_16px] [font-size:13px] [font-weight:600] [color:#fff] [box-shadow:0_14px_40px_rgba(23,_35,_38,_0.32)] [background:var(--sc-ink)] [&_i]:[font-size:18px] [&_i]:[color:#b994f8]">
          <i className="ph-fill ph-check-circle" />
          {toast}
        </div>
      )}
      {deleteOpen && (
        <div
          className="sc-editor-modal [position:fixed] [inset:0] [z-index:80] [display:grid] [place-items:center] [backdrop-filter:blur(2px)] [background:rgba(15,_27,_29,_0.42)] [&_h2]:[margin:14px_0_6px] [&_h2]:[font-size:18px] [&_p]:[margin:0] [&_p]:[font-size:13px] [&_p]:[line-height:1.5] [&_p]:text-ink-muted dark:[&_p]:[color:#a7aeb8] [&_section]:[display:flex] [&_section]:[width:390px] [&_section]:[max-width:calc(100vw_-_40px)] [&_section]:[flex-direction:column] [&_section]:[align-items:center] [&_section]:[border-radius:13px] [&_section]:bg-surface [&_section]:[padding:28px] [&_section]:[text-align:center] [&_section]:[box-shadow:0_24px_70px_rgba(23,_35,_38,_0.25)] dark:[&_section]:[color:#e9ecf1] dark:[&_section]:[background:#1d2126] [&_section>div]:[margin-top:20px] [&_section>div]:[display:flex] [&_section>div]:[gap:8px] [&_section>i]:[display:grid] [&_section>i]:[height:48px] [&_section>i]:[width:48px] [&_section>i]:[place-items:center] [&_section>i]:[border-radius:12px] [&_section>i]:bg-danger-soft [&_section>i]:[font-size:23px] [&_section>i]:text-danger"
          onMouseDown={(event) => event.target === event.currentTarget && onCloseDelete()}
          role="presentation"
        >
          <section>
            <i className="ph ph-trash" />
            <h2>Delete this page?</h2>
            <p>This permanently removes the page and its content. This cannot be undone.</p>
            <div>
              <Button
                unstyled
                className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                onClick={onCloseDelete}
              >
                Cancel
              </Button>
              <Button
                unstyled
                className="sc-action danger [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
                disabled={saving}
                loading={savingAction === "delete"}
                onClick={onDelete}
              >
                Delete page
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
