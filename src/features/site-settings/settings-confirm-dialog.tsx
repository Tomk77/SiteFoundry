import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SettingsConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader className="p-5 pr-12">
          <span className="mb-2 grid size-10 place-items-center rounded-full bg-danger-soft text-lg text-danger">
            <i aria-hidden className="ph ph-warning" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[12px] leading-5 text-ink-muted">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button onClick={onConfirm} type="button" variant="destructive">
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
