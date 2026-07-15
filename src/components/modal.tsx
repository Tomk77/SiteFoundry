import { type ReactNode, useRef } from "react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "./ui/dialog";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

export function Modal({
  open,
  onOpenChange,
  children,
  className = "",
}: ModalProps) {
  const retainedContent = useRef(children);
  if (children) retainedContent.current = children;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="sf-modal-backdrop" />
        <DialogViewport className="sf-modal-viewport">
          <DialogPopup
            className={`sf-overview-modal-panel${className ? ` ${className}` : ""}`}
          >
            {retainedContent.current}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

export const ModalTitle = DialogTitle;
export const ModalDescription = DialogDescription;
export const ModalClose = DialogClose;
