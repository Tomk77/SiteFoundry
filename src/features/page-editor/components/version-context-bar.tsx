import { Button } from "@/components/ui/button";

interface VersionContextBarProps {
  changeCount: number;
  viewingPublished: boolean;
  onDiscard: () => void;
  onViewConcept: () => void;
  onViewPublished: () => void;
}

export function VersionContextBar({
  changeCount,
  viewingPublished,
  onDiscard,
  onViewConcept,
  onViewPublished,
}: VersionContextBarProps) {
  if (viewingPublished) {
    return (
      <div className="sc-version-context [display:flex] [min-height:40px] [align-items:center] [gap:9px] [padding:5px_16px] [color:#12603c] [background:#eef8f2] [border-bottom:1px_solid_#cce7d8] [&>i]:[font-size:16px] [&>span]:[flex:1] [&>span]:[font-size:12.5px] [&>span]:[font-weight:500]">
        <i className="ph-fill ph-globe-simple" />
        <span>
          You&apos;re viewing the <strong>live published version</strong>. It&apos;s read-only.
        </span>
        <Button
          unstyled
          className="[display:inline-flex] [height:28px] [align-items:center] [gap:6px] [border-radius:7px] bg-surface [padding:0_11px] [font-size:12.5px] [font-weight:600] [color:#147a4a] [border:1px_solid_#a9d5bd]"
          onClick={onViewConcept}
        >
          <i className="ph ph-pencil-simple-line" />
          Edit concept
        </Button>
      </div>
    );
  }

  if (changeCount === 0) return null;

  return (
    <div className="sc-version-context [display:flex] [min-height:40px] [align-items:center] [gap:9px] [padding:5px_16px] [color:#7a5405] [background:#fcf6e8] [border-bottom:1px_solid_#ecd9ae] [&>i]:[font-size:16px] [&>span]:[flex:1] [&>span]:[font-size:12.5px] [&>span]:[font-weight:500]">
      <i className="ph-fill ph-pencil-simple-line" />
      <span>
        Editing the concept —{" "}
        <strong>
          {changeCount} unpublished {changeCount === 1 ? "change" : "changes"}
        </strong>{" "}
        not yet live.
      </span>
      <Button
        unstyled
        className="[display:inline-flex] [height:28px] [align-items:center] [gap:6px] [border-radius:7px] bg-surface [padding:0_11px] [font-size:12.5px] [font-weight:600] [color:#8a5a06] [border:1px_solid_#e0c892]"
        onClick={onViewPublished}
      >
        <i className="ph ph-git-diff" />
        View published
      </Button>
      <Button
        unstyled
        className="[display:inline-flex] [height:28px] [align-items:center] [gap:6px] [border-radius:7px] bg-surface [padding:0_11px] [font-size:12.5px] [font-weight:600] [color:#8a5a06] [border:1px_solid_#e0c892]"
        onClick={onDiscard}
      >
        <i className="ph ph-arrow-counter-clockwise" />
        Discard concept
      </Button>
    </div>
  );
}
