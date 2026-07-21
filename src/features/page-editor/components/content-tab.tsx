import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlockType, EditablePage } from "@/lib/page-editor";

import { blockDefinitions } from "../editor-model";

interface ContentTabProps {
  page: EditablePage;
  selected: string | null;
  expanded: Record<string, boolean>;
  addMenu: boolean;
  onAddBlock: (type: BlockType) => void;
  onEditBlock: (id: string, key: string, value: string) => void;
  onMoveBlock: (id: string, direction: number) => void;
  onRemoveBlock: (id: string) => void;
  onSelectBlock: (id: string) => void;
  onToggleAddMenu: () => void;
  onToggleExpanded: (id: string) => void;
}

export function ContentTab({
  page,
  selected,
  expanded,
  addMenu,
  onAddBlock,
  onEditBlock,
  onMoveBlock,
  onRemoveBlock,
  onSelectBlock,
  onToggleAddMenu,
  onToggleExpanded,
}: ContentTabProps) {
  return (
    <div className="sf-block-list [display:flex] [flex-direction:column] [gap:10px]">
      {page.blocks.map((block, index) => {
        const definition = blockDefinitions[block.type];
        const open = Boolean(expanded[block.id]);
        const active = selected === block.id;

        return (
          <article
            className={`sf-block [overflow:hidden] [border-radius:10px] bg-surface [border:1.5px_solid_var(--sf-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&.selected]:border-selection-border dark:[&.selected]:[border-color:#515a65] [&.selected>header]:bg-selection-surface dark:[&.selected>header]:[background:#2c333b] [&>header]:[display:flex] [&>header]:[cursor:pointer] [&>header]:[align-items:center] [&>header]:[gap:9px] [&>header]:bg-surface [&>header]:[padding:9px_10px] dark:[&>header]:[border-color:#3d444e] dark:[&>header]:[color:#e9ecf1] dark:[&>header]:[background:#1d2126] [&>header_button]:[display:grid] [&>header_button]:[height:24px] [&>header_button]:[width:24px] [&>header_button]:[cursor:pointer] [&>header_button]:[place-items:center] [&>header_button]:[border-radius:6px] [&>header_button]:[font-size:14px] [&>header_button]:text-ink-subtle [&>header_button]:[background:transparent] [&>header_button]:[border:0] [&>header_button:disabled]:[cursor:default] [&>header_button:disabled]:[color:#d3dad5] [&>header_button:hover]:bg-sunken dark:[&>header_button:hover]:[color:#e9ecf1] dark:[&>header_button:hover]:[background:#242930] [&>header_button:nth-last-of-type(1):hover]:bg-danger-soft [&>header_button:nth-last-of-type(1):hover]:text-danger [&>header_strong]:[font-size:13px] [&>header>.ph-caret-down]:[font-size:14px] [&>header>.ph-caret-down]:text-ink-subtle [&>header>.ph-caret-down]:[transition:transform_0.15s] [&>header>.ph-caret-down.open]:[transform:rotate(180deg)] ${active ? "selected" : ""}`}
            key={block.id}
          >
            <header
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectBlock(block.id);
                onToggleExpanded(block.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelectBlock(block.id);
                onToggleExpanded(block.id);
              }}
            >
              <span
                className={`sf-block-icon [display:grid] [height:28px] [width:28px] [flex:none] [place-items:center] [border-radius:7px] bg-selection [font-size:15px] text-action [&.cta]:bg-clay-soft [&.cta]:text-clay-dark [&.image]:[color:#3f5c8a] [&.image]:[background:#e7eef5] [&.quote]:[color:#5b4b8a] [&.quote]:[background:#ede7f5] [&.richtext]:bg-sunken [&.richtext]:text-ink-muted ${block.type}`}
              >
                <i className={`ph ${definition.icon}`} />
              </span>
              <strong>{definition.label}</strong>
              <span className="sf-spacer [flex:1]" />
              <Button
                unstyled
                disabled={index === 0}
                title="Move up"
                onClick={(event) => {
                  event.stopPropagation();
                  onMoveBlock(block.id, -1);
                }}
              >
                <i className="ph-bold ph-arrow-up" />
              </Button>
              <Button
                unstyled
                disabled={index === page.blocks.length - 1}
                title="Move down"
                onClick={(event) => {
                  event.stopPropagation();
                  onMoveBlock(block.id, 1);
                }}
              >
                <i className="ph-bold ph-arrow-down" />
              </Button>
              <Button
                unstyled
                title="Remove block"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveBlock(block.id);
                }}
              >
                <i className="ph ph-trash" />
              </Button>
              <i className={`ph ph-caret-down ${open ? "open" : ""}`} />
            </header>
            {open && (
              <div className="sf-block-fields [display:flex] [flex-direction:column] [gap:12px] [padding:12px] [border-top:1px_solid_var(--sf-sunken)] dark:[border-color:#323841]">
                {definition.fields.map((field) => (
                  <label
                    className="sf-editor-field [display:flex] [flex-direction:column] [gap:5px] [&>em]:[display:flex] [&>em]:[align-items:flex-start] [&>em]:[gap:5px] [&>em]:[font-size:11.5px] [&>em]:[line-height:1.4] [&>em]:text-concept [&>em]:[font-style:normal] [&>p]:[margin:0] [&>p]:[font-size:11.5px] [&>p]:text-ink-subtle dark:[&>p]:[color:#79808b] [&>small]:[text-align:right] [&>small]:text-ink-subtle [&>small]:[font:11px_'Geist_Mono'] dark:[&>small]:[color:#79808b] [&>small.over]:text-danger [&>span]:[font-size:11px] [&>span]:[font-weight:600] [&>span]:[letter-spacing:0.04em] [&>span]:[color:#a5b0ad] [&>span]:[text-transform:uppercase] dark:[&>span]:[color:#79808b]"
                    key={field.key}
                  >
                    <span>{field.label}</span>
                    {field.type === "area" ? (
                      <Textarea
                        unstyled
                        className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
                        value={block.data[field.key] || ""}
                        data-editor-block={block.id}
                        data-editor-field={field.key}
                        placeholder={field.placeholder}
                        onFocus={() => {
                          if (selected !== block.id) onSelectBlock(block.id);
                        }}
                        onChange={(event) => onEditBlock(block.id, field.key, event.target.value)}
                      />
                    ) : (
                      <Input
                        unstyled
                        className="sf-editor-input [width:100%] [border-radius:8px] bg-surface [padding:8px_10px] [font-size:13px] text-ink [outline:0] [border:1.5px_solid_var(--sf-field)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:focus]:border-action [&:focus]:[box-shadow:0_0_0_3px_rgba(118,_63,_186,_0.15)] [textarea&]:[min-height:76px] [textarea&]:[resize:vertical] [textarea&]:[line-height:1.5]"
                        value={block.data[field.key] || ""}
                        data-editor-block={block.id}
                        data-editor-field={field.key}
                        placeholder={field.placeholder}
                        onFocus={() => {
                          if (selected !== block.id) onSelectBlock(block.id);
                        }}
                        onChange={(event) => onEditBlock(block.id, field.key, event.target.value)}
                      />
                    )}
                    {block.type === "image" && field.key === "alt" && !block.data.alt?.trim() && (
                      <em>
                        <i className="ph-fill ph-warning" />
                        Alt text is required for accessibility.
                      </em>
                    )}
                  </label>
                ))}
              </div>
            )}
          </article>
        );
      })}
      <div className="sf-add-block [position:relative] [&>button]:[display:inline-flex] [&>button]:[height:42px] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[justify-content:center] [&>button]:[gap:7px] [&>button]:[border-radius:10px] [&>button]:[font-size:13px] [&>button]:[font-weight:600] [&>button]:text-action [&>button]:[background:#fafcfa] [&>button]:[border:1.5px_dashed_#c2ccc4] dark:[&>button]:[border-color:#323841] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#242930] [&>button:hover]:border-selection-border [&>button:hover]:bg-selection">
        <Button unstyled onClick={onToggleAddMenu}>
          <i className="ph-bold ph-plus" />
          Add block
        </Button>
        {addMenu && (
          <div className="sf-add-menu [position:absolute] [right:0] [bottom:48px] [left:0] [z-index:20] [animation:sf-editor-pop_0.13s_ease] [border-radius:10px] bg-surface [padding:5px] [box-shadow:0_12px_32px_rgba(23,_35,_38,_0.16)] [border:1px_solid_var(--sf-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle dark:[&_small]:[color:#79808b] [&_strong]:[font-size:13px] [&>button]:[display:flex] [&>button]:[width:100%] [&>button]:[cursor:pointer] [&>button]:[align-items:center] [&>button]:[gap:10px] [&>button]:[border-radius:7px] [&>button]:bg-surface [&>button]:[padding:8px_9px] [&>button]:[text-align:left] [&>button]:[border:0] dark:[&>button]:[border-color:#3d444e] dark:[&>button]:[color:#e9ecf1] dark:[&>button]:[background:#1d2126] [&>button:hover]:bg-canvas dark:[&>button:hover]:[color:#e9ecf1] dark:[&>button:hover]:[background:#242930] [&>button>i]:[display:grid] [&>button>i]:[height:30px] [&>button>i]:[width:30px] [&>button>i]:[flex:none] [&>button>i]:[place-items:center] [&>button>i]:[border-radius:7px] [&>button>i]:bg-sunken [&>button>i]:[font-size:16px] [&>button>i]:text-action [&>button>span]:[display:flex] [&>button>span]:[flex-direction:column]">
            {(Object.keys(blockDefinitions) as BlockType[]).map((type) => (
              <Button unstyled onClick={() => onAddBlock(type)} key={type}>
                <i className={`ph ${blockDefinitions[type].icon}`} />
                <span>
                  <strong>{blockDefinitions[type].label}</strong>
                  <small>{blockDefinitions[type].description}</small>
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
