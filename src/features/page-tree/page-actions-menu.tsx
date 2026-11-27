import { Button } from "@/components/ui/button";
import type { PageNode } from "@/lib/page-tree";

export interface PageActionsMenuProps {
  page: PageNode & { hasChildren: boolean };
  onEdit: () => void;
  onAddChild: () => void;
  onRename: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}

/** Row action menu in the page tree. */
export function PageActionsMenu({
  page,
  onEdit,
  onAddChild,
  onRename,
  onUnpublish,
  onDelete,
}: PageActionsMenuProps) {
  return (
    <div
      className="sc-row-menu [position:absolute] [top:calc(100%_-_4px)] [right:8px] [z-index:25] [width:178px] [border-radius:9px] border border-border bg-surface [padding:5px] [box-shadow:0_12px_28px_rgba(23,_35,_38,_0.16)] [&_button]:[display:flex] [&_button]:[width:100%] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:8px] [&_button]:[border-radius:6px] [&_button]:[padding:8px_9px] [&_button]:[text-align:left] [&_button]:[font-size:12px] [&_button]:text-ink [&_button]:[background:transparent] [&_button]:[border:0] [&_button.danger]:text-danger [&_button:disabled]:[cursor:not-allowed] [&_button:disabled]:[opacity:0.42] [&_button:disabled:hover]:[background:transparent] [&_button:hover]:bg-muted"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      role="presentation"
    >
      <Button unstyled onClick={onEdit}>
        <i className="ph ph-pencil-simple" /> Edit page
      </Button>
      <Button unstyled onClick={onAddChild}>
        <i className="ph ph-plus" /> Add child page
      </Button>
      <Button unstyled onClick={onRename}>
        <i className="ph ph-text-t" /> Rename title
      </Button>
      {page.status === "Published" && !page.isHomepage ? (
        <Button unstyled onClick={onUnpublish}>
          <i className="ph ph-eye-slash" /> Unpublish page
        </Button>
      ) : null}
      <Button
        unstyled
        className="danger"
        disabled={page.isHomepage || page.hasChildren}
        title={
          page.isHomepage
            ? "The homepage cannot be deleted"
            : page.hasChildren
              ? "Move or delete child pages first"
              : undefined
        }
        onClick={onDelete}
      >
        <i className="ph ph-trash" /> Delete page
      </Button>
    </div>
  );
}
