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
import { cn } from "../lib/utils";

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
        <DialogOverlay className="sc-modal-backdrop fixed inset-0 z-[80] bg-[rgba(15,27,29,0.42)] backdrop-blur-[2px] transition-opacity duration-160 motion-reduce:duration-[0.01ms] [&[data-ending-style]]:opacity-0 [&[data-ending-style]]:duration-120 [&[data-starting-style]]:opacity-0" />
        <DialogViewport className="sc-modal-viewport fixed inset-0 z-[81] grid place-items-center overflow-y-auto p-6">
          <DialogPopup
            className={cn(
              "sc-overview-modal-panel w-[min(460px,100%)] origin-center overflow-hidden rounded-[13px] bg-surface text-ink shadow-[0_24px_70px_rgb(23_35_38_/_25%)] transition-[opacity,transform] duration-160 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-[0.01ms] dark:border dark:border-field [&_h2]:mt-0 [&_h2]:mb-[3px] [&_h2]:text-[17px] [&_p]:m-0 [&_p]:font-mono [&_p]:text-[11.5px] [&_p]:text-ink-subtle [&>footer]:flex [&>footer]:justify-end [&>footer]:gap-2 [&>footer]:border-t [&>footer]:border-border [&>footer]:bg-[#fafcfa] [&>footer]:px-5 [&>footer]:py-[13px] dark:[&>footer]:bg-sunken [&>header]:flex [&>header]:items-start [&>header]:justify-between [&>header]:border-b [&>header]:border-border [&>header]:px-5 [&>header]:py-[18px] [&>header>button]:grid [&>header>button]:size-7 [&>header>button]:cursor-pointer [&>header>button]:place-items-center [&>header>button]:rounded-md [&>header>button]:border-0 [&>header>button]:bg-transparent [&>header>button]:text-ink-subtle [&[data-ending-style]]:translate-y-1.5 [&[data-ending-style]]:scale-[0.985] [&[data-ending-style]]:opacity-0 [&[data-ending-style]]:duration-120 [&[data-starting-style]]:translate-y-1.5 [&[data-starting-style]]:scale-[0.985] [&[data-starting-style]]:opacity-0",
              className,
            )}
          >
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
