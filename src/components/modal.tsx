import type { ReactNode } from "react";
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

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, children, className = "" }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="sf-modal-backdrop" />
        <DialogViewport className="sf-modal-viewport">
          <DialogPopup className={`sf-overview-modal-panel${className ? ` ${className}` : ""}`}>
            {children}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}

export const ModalTitle = DialogTitle;
export const ModalDescription = DialogDescription;
export const ModalClose = DialogClose;
