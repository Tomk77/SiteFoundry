import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode, useRef } from "react";

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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sf-modal-backdrop" />
        <Dialog.Viewport className="sf-modal-viewport">
          <Dialog.Popup
            className={`sf-overview-modal-panel${className ? ` ${className}` : ""}`}
          >
            {retainedContent.current}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalTitle = Dialog.Title;
export const ModalDescription = Dialog.Description;
export const ModalClose = Dialog.Close;
