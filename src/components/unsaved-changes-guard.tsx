import { useBlocker } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { Modal, ModalDescription, ModalTitle } from "./modal";

/**
 * Asks before leaving a screen with unsaved changes: router navigation shows a dialog, closing or
 * reloading the tab shows the browser's own prompt (finding 5.2).
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });
  const blocked = blocker.status === "blocked";

  return (
    <Modal open={blocked} onOpenChange={(open) => !open && blocked && blocker.reset()}>
      {blocked ? (
        <>
          <header>
            <div>
              <ModalTitle>Leave without saving?</ModalTitle>
              <ModalDescription>Your unsaved changes will be lost.</ModalDescription>
            </div>
          </header>
          <footer>
            <Button onClick={() => blocker.reset()} variant="outline">
              Stay
            </Button>
            <Button onClick={() => blocker.proceed()} variant="destructive">
              Leave
            </Button>
          </footer>
        </>
      ) : null}
    </Modal>
  );
}
