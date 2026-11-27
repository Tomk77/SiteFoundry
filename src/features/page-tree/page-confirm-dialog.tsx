import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalClose, ModalDescription, ModalTitle } from "@/components/modal";

export interface PageConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  message: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmation for page operations that change the live site, such as delete and unpublish. */
export function PageConfirmDialog({
  open,
  title,
  description,
  message,
  confirmLabel,
  busyLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: PageConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      {open ? (
        <>
          <header>
            <div>
              <ModalTitle>{title}</ModalTitle>
              <ModalDescription>{description}</ModalDescription>
            </div>
            <ModalClose disabled={busy}>
              <i className="ph ph-x" />
            </ModalClose>
          </header>
          <div className="sc-overview-modal-body [display:flex] [flex-direction:column] [gap:15px] [padding:20px] [&_.sc-redirect-choice_input[type='checkbox']]:[margin:1px_0_0] [&_.sc-redirect-choice_input[type='checkbox']]:[height:17px] [&_.sc-redirect-choice_input[type='checkbox']]:[width:17px] [&_.sc-redirect-choice_input[type='checkbox']]:[min-width:17px] [&_.sc-redirect-choice_input[type='checkbox']]:[flex:none] [&_.sc-redirect-choice_input[type='checkbox']]:[border-radius:3px] [&_.sc-redirect-choice_input[type='checkbox']]:[padding:0] [&_.sc-redirect-choice_input[type='checkbox']]:[accent-color:var(--sc-accent)] [&_.sc-redirect-choice_input[type='checkbox']]:[box-shadow:none] [&_.sc-redirect-choice_input[type='checkbox']]:[border:0] [&_input]:[height:38px] [&_input]:[width:100%] [&_input]:[border-radius:8px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:13px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1.5px_solid_var(--sc-field)] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_label>span]:[font-size:11.5px] [&_label>span]:[font-weight:600] [&_label>span]:text-ink-muted [&_select]:[height:38px] [&_select]:[width:100%] [&_select]:[border-radius:8px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:13px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1.5px_solid_var(--sc-field)] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [&_small]:[font-size:11px] [&_small]:text-ink-subtle [&>label]:[display:flex] [&>label]:[flex-direction:column] [&>label]:[gap:5px]">
            <p className="sc-delete-copy [margin:0] text-ink-muted [font:13px/1.5_'Geist'] [&_strong]:text-ink">
              {message}
            </p>
            {error ? (
              <p className="sc-modal-error [margin:0] [border-radius:7px] [padding:9px_10px] [font-size:12px] [color:#a52f26] [background:#f9e8e5] [font:11.5px_'Geist']">
                {error}
              </p>
            ) : null}
          </div>
          <footer>
            <ModalClose
              className="sc-action [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
              disabled={busy}
            >
              Cancel
            </ModalClose>
            <Button
              unstyled
              className="sc-action danger [display:inline-flex] [height:36px] [cursor:pointer] [align-items:center] [gap:7px] [border-radius:8px] bg-surface [padding:0_12px] [font-size:13px] [font-weight:600] [white-space:nowrap] [border:1px_solid_#cfd6d0] [&.active]:border-selection-border [&.active]:bg-selection [&.active]:text-action dark:[&.active]:[border-color:#515a65] dark:[&.active]:[color:#b994f8] dark:[&.active]:[background:#2c333b] [&.danger]:border-danger [&.danger]:[color:#fff] [&.danger]:[background:var(--sc-danger)] [&.danger:hover:not(:disabled)]:bg-danger-soft [&.primary]:border-action [&.primary]:bg-action [&.primary]:[padding:0_14px] [&.primary]:[color:#fff] [&.primary]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.1)] [&:disabled]:[cursor:not-allowed] [&:disabled]:[opacity:0.48] dark:[&:not(.primary)]:[border-color:#3d444e] dark:[&:not(.primary)]:[color:#e9ecf1] dark:[&:not(.primary)]:[background:#1d2126]"
              disabled={busy}
              loading={busy}
              onClick={onConfirm}
            >
              {busy ? busyLabel : confirmLabel}
            </Button>
          </footer>
        </>
      ) : null}
    </Modal>
  );
}
