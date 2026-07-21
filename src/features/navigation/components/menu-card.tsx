import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { NavigationItem, NavigationLocation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { DragEvent } from "react";

import { itemTheme } from "../editor-model";

export function MenuCard({
  item,
  index,
  total,
  selected,
  expanded,
  broken,
  drop,
  location,
  pageOptions,
  onSelect,
  onToggle,
  onUpdate,
  onMove,
  onChildMove,
  onAddChild,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  item: NavigationItem;
  index: number;
  total: number;
  selected: boolean;
  expanded: boolean;
  broken: boolean;
  drop: boolean;
  location: NavigationLocation;
  pageOptions: { id: string; title: string; path: string }[];
  onSelect: () => void;
  onToggle: () => void;
  onUpdate: (id: string, patch: Partial<NavigationItem>) => void;
  onMove: (direction: -1 | 1) => void;
  onChildMove: (id: string, direction: -1 | 1) => void;
  onAddChild: () => void;
  onRemove: (id: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const theme = itemTheme[item.kind];

  return (
    <div
      className={cn(
        "sf-menu-card [overflow:hidden] [border-radius:10px] bg-surface [border:1px_solid_#dce3de] [transition:border-color_120ms,_box-shadow_120ms] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&.drop]:[border-top:3px_solid_var(--sf-accent)] [&.selected]:border-selection-border [&.selected]:[box-shadow:0_0_0_1px_var(--sf-selection-border)] dark:[&.selected]:[border-color:#515a65] dark:[&.selected]:[box-shadow:0_0_0_1px_#515a65]",
        selected && "selected",
        drop && "drop",
      )}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <div className="sf-menu-card-head [display:flex] [min-height:52px] [cursor:pointer] [align-items:center] [gap:9px] [padding:9px_10px_9px_8px] [&_.ph-caret-down]:[transition:transform_150ms] [&_.ph-caret-down.open]:[transform:rotate(180deg)] [&>button:not(.sf-menu-card-copy)]:[display:grid] [&>button:not(.sf-menu-card-copy)]:[height:24px] [&>button:not(.sf-menu-card-copy)]:[width:24px] [&>button:not(.sf-menu-card-copy)]:[flex:none] [&>button:not(.sf-menu-card-copy)]:[cursor:pointer] [&>button:not(.sf-menu-card-copy)]:[place-items:center] [&>button:not(.sf-menu-card-copy)]:[border-radius:6px] [&>button:not(.sf-menu-card-copy)]:[padding:0] [&>button:not(.sf-menu-card-copy)]:[color:#8b9b97] [&>button:not(.sf-menu-card-copy)]:[background:transparent] [&>button:not(.sf-menu-card-copy)]:[border:0] [&>button:not(.sf-menu-card-copy):disabled]:[cursor:default] [&>button:not(.sf-menu-card-copy):disabled]:[color:#d7ddda] [&>button:not(.sf-menu-card-copy):hover]:bg-sunken dark:[&>button:not(.sf-menu-card-copy):hover]:[background:#242930]">
        <i className="ph ph-dots-six-vertical sf-drag-handle [cursor:grab] [color:#b3beb9]" />
        <span
          className="sf-menu-kind [display:grid] [height:26px] [width:26px] [flex:none] [place-items:center] [border-radius:7px] bg-selection text-action"
          style={{ background: theme.bg, color: theme.fg }}
        >
          <i className={`ph ${theme.icon}`} />
        </span>
        <Button
          unstyled
          className="sf-menu-card-copy [display:flex] [min-width:0] [flex:1] [flex-direction:column] [&_small]:[overflow:hidden] [&_small]:[font-size:10.5px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:#9aa8a4] dark:[&_small]:[color:#79808b] [&_strong]:[overflow:hidden] [&_strong]:[font-size:13px] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap]"
          onClick={onSelect}
          type="button"
        >
          <strong>{item.label || "Untitled item"}</strong>
          <small className="sf-mono [font-family:'Geist_Mono',_monospace]">
            {item.kind === "group"
              ? `${location === "footer" ? "Column" : "Dropdown"} · ${item.children.length} ${item.children.length === 1 ? "link" : "links"}`
              : `${item.kind === "button" ? "Button · " : ""}${item.target}`}
          </small>
        </Button>
        {broken ? (
          <i
            className="ph-fill ph-warning sf-menu-warning [font-size:14px] text-danger"
            title="One or more target pages do not exist"
          />
        ) : null}
        <Button
          unstyled
          disabled={index === 0}
          onClick={(event) => {
            event.stopPropagation();
            onMove(-1);
          }}
          title="Move up"
          type="button"
        >
          <i className="ph-bold ph-arrow-up" />
        </Button>
        <Button
          unstyled
          disabled={index === total - 1}
          onClick={(event) => {
            event.stopPropagation();
            onMove(1);
          }}
          title="Move down"
          type="button"
        >
          <i className="ph-bold ph-arrow-down" />
        </Button>
        <Button
          unstyled
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          title={expanded ? "Collapse" : "Expand"}
          type="button"
        >
          <i className={cn("ph ph-caret-down", expanded && "open")} />
        </Button>
      </div>
      {expanded ? (
        <div className="sf-menu-card-fields [display:flex] [flex-direction:column] [gap:13px] [padding:13px_14px_14px] [background:#fafcfa] [border-top:1px_solid_var(--sf-sunken)] dark:[border-color:#323841] dark:[background:#242930]">
          <label
            className="sf-builder-field [display:flex] [flex-direction:column] [gap:5px] [&_input]:[height:36px] [&_input]:[width:100%] [&_input]:[border-radius:7px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:12.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:12.5px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]"
            htmlFor={`navigation-label-${item.id}`}
          >
            <span>Label</span>
            <Input
              unstyled
              id={`navigation-label-${item.id}`}
              value={item.label}
              onChange={(event) => onUpdate(item.id, { label: event.target.value })}
            />
          </label>
          {item.kind === "group" ? (
            <div className="sf-child-links [display:flex] [flex-direction:column] [gap:7px] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]">
              <span>
                {location === "footer" ? "Links in this column" : "Links in this dropdown"}
              </span>
              {item.children.map((child, childIndex) => (
                <div
                  className="sf-child-link [display:flex] [align-items:center] [gap:7px] [border-radius:9px] bg-surface [padding:7px_8px] [border:1px_solid_#e7ece8] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&_input]:[height:30px] [&_input]:[width:100%] [&_input]:[border-radius:7px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:11.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&_select]:[height:30px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:11.5px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&>button]:[display:grid] [&>button]:[height:24px] [&>button]:[width:24px] [&>button]:[flex:none] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:6px] [&>button]:[padding:0] [&>button]:[color:#8b9b97] [&>button]:[background:transparent] [&>button]:[border:0] [&>button:disabled]:[cursor:default] [&>button:disabled]:[color:#d7ddda] [&>button:hover]:bg-sunken dark:[&>button:hover]:[background:#242930] [&>div]:[display:grid] [&>div]:[min-width:0] [&>div]:[flex:1] [&>div]:[grid-template-columns:1fr] [&>div]:[gap:5px]"
                  key={child.id}
                >
                  <span className="sf-menu-kind [display:grid] [height:26px] [width:26px] [flex:none] [place-items:center] [border-radius:7px] bg-selection text-action">
                    <i className="ph ph-link-simple" />
                  </span>
                  <div>
                    <Input
                      unstyled
                      aria-label="Link label"
                      value={child.label}
                      onChange={(event) => onUpdate(child.id, { label: event.target.value })}
                    />
                    <NativeSelect
                      unstyled
                      aria-label="Link target"
                      value={child.target}
                      onChange={(event) =>
                        onUpdate(child.id, {
                          target: event.target.value,
                          targetType: "page",
                        })
                      }
                    >
                      {!pageOptions.some((page) => page.path === child.target) ? (
                        <option value={child.target}>{child.target} (missing)</option>
                      ) : null}
                      {pageOptions.map((page) => (
                        <option key={page.id} value={page.path}>
                          {page.title} · {page.path}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button
                    unstyled
                    disabled={childIndex === 0}
                    onClick={() => onChildMove(child.id, -1)}
                    title="Move up"
                    type="button"
                  >
                    <i className="ph-bold ph-arrow-up" />
                  </Button>
                  <Button
                    unstyled
                    disabled={childIndex === item.children.length - 1}
                    onClick={() => onChildMove(child.id, 1)}
                    title="Move down"
                    type="button"
                  >
                    <i className="ph-bold ph-arrow-down" />
                  </Button>
                  <Button
                    unstyled
                    onClick={() => onRemove(child.id)}
                    title="Remove link"
                    type="button"
                  >
                    <i className="ph ph-x" />
                  </Button>
                </div>
              ))}
              <Button
                unstyled
                className="sf-add-child [display:inline-flex] [height:34px] [cursor:pointer] [align-items:center] [justify-content:center] [gap:6px] [border-radius:9px] bg-surface [font-size:12.5px] [font-weight:600] text-action [border:1.5px_dashed_#c2ccc4] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:border-selection-border [&:hover]:bg-selection dark:[&:hover]:[color:#b994f8] dark:[&:hover]:[background:#2c333b]"
                onClick={onAddChild}
                type="button"
              >
                <i className="ph-bold ph-plus" /> Add link to{" "}
                {location === "footer" ? "column" : "dropdown"}
              </Button>
            </div>
          ) : (
            <>
              <div className="sf-link-type [display:flex] [align-items:center] [gap:10px] [&_button]:[height:26px] [&_button]:[cursor:pointer] [&_button]:[border-radius:5px] [&_button]:[padding:0_10px] [&_button]:[font-size:11.5px] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border:0] dark:[&_button]:[color:#a7aeb8] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgb(23_35_38_/_10%)] dark:[&_button.active]:[color:#b994f8] dark:[&_button.active]:[box-shadow:none] dark:[&_button.active]:[background:#2c333b] [&>div]:[display:flex] [&>div]:[border-radius:7px] [&>div]:bg-sunken [&>div]:[padding:2px] dark:[&>div]:[background:#15181c] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]">
                <span>Links to</span>
                <div>
                  <Button
                    unstyled
                    className={item.targetType === "page" ? "active" : ""}
                    onClick={() =>
                      onUpdate(item.id, {
                        targetType: "page",
                        target: pageOptions[0]?.path ?? "/",
                      })
                    }
                    type="button"
                  >
                    Page
                  </Button>
                  <Button
                    unstyled
                    className={item.targetType === "url" ? "active" : ""}
                    onClick={() =>
                      onUpdate(item.id, {
                        targetType: "url",
                        target: "https://",
                      })
                    }
                    type="button"
                  >
                    Custom URL
                  </Button>
                </div>
              </div>
              <label className="sf-builder-field [display:flex] [flex-direction:column] [gap:5px] [&_input]:[height:36px] [&_input]:[width:100%] [&_input]:[border-radius:7px] [&_input]:bg-surface [&_input]:[padding:0_10px] [&_input]:[font-size:12.5px] [&_input]:text-ink [&_input]:[outline:0] [&_input]:[border:1px_solid_var(--sf-field)] dark:[&_input]:[border-color:#3d444e] dark:[&_input]:[color:#e9ecf1] dark:[&_input]:[background:#15181c] [&_input:focus]:border-action [&_input:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&_select]:[height:36px] [&_select]:[width:100%] [&_select]:[border-radius:7px] [&_select]:bg-surface [&_select]:[padding:0_10px] [&_select]:[font-size:12.5px] [&_select]:text-ink [&_select]:[outline:0] [&_select]:[border:1px_solid_var(--sf-field)] dark:[&_select]:[border-color:#3d444e] dark:[&_select]:[color:#e9ecf1] dark:[&_select]:[background:#15181c] [&_select:focus]:border-action [&_select:focus]:[box-shadow:0_0_0_3px_rgb(118_63_186_/_12%)] [&>span]:[font-size:11.5px] [&>span]:[font-weight:600] [&>span]:text-ink-muted dark:[&>span]:[color:#a7aeb8]">
                <span>{item.targetType === "page" ? "Page" : "URL"}</span>
                {item.targetType === "page" ? (
                  <NativeSelect
                    unstyled
                    value={item.target}
                    onChange={(event) => onUpdate(item.id, { target: event.target.value })}
                  >
                    {!pageOptions.some((page) => page.path === item.target) ? (
                      <option value={item.target}>{item.target} (missing)</option>
                    ) : null}
                    {pageOptions.map((page) => (
                      <option key={page.id} value={page.path}>
                        {page.title} · {page.path}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    unstyled
                    className="sf-mono [font-family:'Geist_Mono',_monospace]"
                    value={item.target}
                    onChange={(event) => onUpdate(item.id, { target: event.target.value })}
                  />
                )}
              </label>
              <label className="sf-new-tab [display:flex] [cursor:pointer] [align-items:center] [gap:8px] [font-size:12px] text-ink-muted dark:[color:#a7aeb8] [&_input]:[height:16px] [&_input]:[width:16px] [&_input]:[accent-color:var(--sf-accent)]">
                <Input
                  unstyled
                  checked={item.newTab}
                  onChange={(event) => onUpdate(item.id, { newTab: event.target.checked })}
                  type="checkbox"
                />{" "}
                Open in a new tab
              </label>
            </>
          )}
          <div className="sf-card-bottom [display:flex] [align-items:center] [padding-top:3px] [&>span_i]:text-action [&>span:not(.sf-spacer)]:[display:inline-flex] [&>span:not(.sf-spacer)]:[align-items:center] [&>span:not(.sf-spacer)]:[gap:5px] [&>span:not(.sf-spacer)]:[font-size:11.5px] [&>span:not(.sf-spacer)]:text-ink-subtle dark:[&>span:not(.sf-spacer)]:[color:#79808b]">
            {item.kind === "button" ? (
              <span>
                <i className="ph-fill ph-cursor-click" /> Shown as a button
              </span>
            ) : null}
            <span className="sf-spacer [flex:1]" />
            <Button
              unstyled
              className="sf-remove-item [display:inline-flex] [height:30px] [cursor:pointer] [align-items:center] [gap:6px] [border-radius:7px] bg-surface [padding:0_11px] [font-size:12px] [font-weight:600] text-danger [border:1px_solid_#eec6bc] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&:hover]:bg-danger-soft"
              onClick={() => onRemove(item.id)}
              type="button"
            >
              <i className="ph ph-trash" /> Remove {location === "footer" ? "item" : "menu item"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
