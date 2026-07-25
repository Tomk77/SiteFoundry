import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EditablePage } from "@/lib/page-editor";

interface SeoTabProps {
  page: EditablePage;
  path: string;
  problems: string[];
  onChange: (changes: Partial<EditablePage>) => void;
  onShowToast: (message: string) => void;
}

export function SeoTab({ page, path, problems, onChange, onShowToast }: SeoTabProps) {
  return (
    <div className="sc-editor-form [display:flex] [flex-direction:column] [gap:16px] [&.settings]:[gap:18px]">
      {problems.length > 0 && (
        <div className="sc-seo-problems [display:flex] [flex-direction:column] [gap:7px] [border-radius:10px] [padding:12px] [color:#7a5405] [background:#fcf6e8] [border:1px_solid_#ecd9ae] dark:[border-color:#6d5522] dark:[color:#e0b341] dark:[background:#2c281c] [&_span]:[padding-left:22px] [&_span]:[font-size:12px] [&_strong]:[display:flex] [&_strong]:[align-items:center] [&_strong]:[gap:7px] [&_strong]:[font-size:12.5px] [&_strong]:text-concept">
          <strong>
            <i className="ph-fill ph-warning" />
            {problems.length} to resolve before publishing
          </strong>
          {problems.map((problem, index) => (
            <span key={`${problem}-${index}`}>· {problem}</span>
          ))}
        </div>
      )}
      <label
        className="sc-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
        htmlFor="seo-title"
      >
        <span>Meta title</span>
        <Input
          unstyled
          className="sc-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
          id="seo-title"
          value={page.seoTitle}
          onChange={(event) => onChange({ seoTitle: event.target.value })}
        />
        <small>{page.seoTitle.length}/60</small>
      </label>
      <label
        className="sc-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
        htmlFor="seo-description"
      >
        <span>Meta description</span>
        <Textarea
          unstyled
          className="sc-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sc-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
          id="seo-description"
          value={page.seoDescription}
          onChange={(event) => onChange({ seoDescription: event.target.value })}
          placeholder="Summarize this page for search results"
        />
        <small className={page.seoDescription.length > 160 ? "over" : ""}>
          {page.seoDescription.length}/160
        </small>
      </label>
      <div className="sc-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
        <span>Social share image</span>
        <div className="sc-social-image [display:flex] [align-items:center] [gap:11px] [border-radius:10px] [padding:11px] [background:#fafcfa] [border:1px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[color:#e9ecf1] dark:[background:#242930] [&_button]:[height:30px] [&_button]:[cursor:pointer] [&_button]:[border-radius:7px] [&_button]:bg-surface [&_button]:[padding:0_10px] [&_button]:[font-size:12px] [&_button]:[font-weight:600] [&_button]:[border:1px_solid_var(--sc-field)] dark:[&_button]:[border-color:#3d444e] dark:[&_button]:[color:#e9ecf1] dark:[&_button]:[background:#1d2126] [&>b]:[flex:1] [&>b]:[overflow:hidden] [&>b]:[text-overflow:ellipsis] [&>b]:text-ink-muted [&>b]:[font:12.5px_'Geist_Mono'] dark:[&>b]:[color:#a7aeb8] [&>i]:[display:grid] [&>i]:[height:36px] [&>i]:[width:56px] [&>i]:[flex:none] [&>i]:[place-items:center] [&>i]:[border-radius:6px] [&>i]:[font-size:18px] [&>i]:[color:#7f8fa9] [&>i]:[background:#e7eef5]">
          <i className="ph-fill ph-image" />
          <b>{page.socialImage || "og-default.png"}</b>
          <Button
            unstyled
            onClick={() => onShowToast("Media selection will be connected with uploading later")}
          >
            Replace
          </Button>
        </div>
      </div>
      <div className="sc-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]">
        <span>Canonical URL</span>
        <div className="sc-canonical [display:flex] [align-items:center] [gap:8px] [border-radius:8px] [padding:9px_10px] [background:#f0f2f5] [border:1.5px_solid_var(--sc-border)] dark:[border-color:#323841] dark:[color:#e9ecf1] dark:[background:#242930] [&_b]:[flex:1] [&_b]:[overflow:hidden] [&_b]:[text-overflow:ellipsis] [&_b]:[white-space:nowrap] [&_b]:text-ink-muted [&_b]:[font:12.5px_'Geist_Mono'] dark:[&_b]:[color:#a7aeb8] [&_i]:[color:#aebab6]">
          <b>acme.com{path}</b>
          <i className="ph-fill ph-lock-simple" />
        </div>
      </div>
    </div>
  );
}
