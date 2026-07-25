import { Button } from "@/components/ui/button";
import type { BlockType, EditablePage } from "@/lib/page-editor";
import type { PageTemplateDefinition } from "@/lib/page-templates";

import type { Tab } from "../editor-model";
import { ContentTab } from "./content-tab";
import { SeoTab } from "./seo-tab";
import { SettingsTab } from "./settings-tab";

interface EditorPanelProps {
  addMenu: boolean;
  availableTemplates: PageTemplateDefinition[];
  expanded: Record<string, boolean>;
  page: EditablePage;
  path: string;
  problems: string[];
  readOnly: boolean;
  selected: string | null;
  tab: Tab;
  onAddBlock: (type: BlockType) => void;
  onChange: (changes: Partial<EditablePage>) => void;
  onDeleteRequest: () => void;
  onEditBlock: (id: string, key: string, value: string) => void;
  onMoveBlock: (id: string, direction: number) => void;
  onRemoveBlock: (id: string) => void;
  onSelectBlock: (id: string) => void;
  onSelectTab: (tab: Tab) => void;
  onShowToast: (message: string) => void;
  onToggleAddMenu: () => void;
  onToggleExpanded: (id: string) => void;
}

export function EditorPanel(props: EditorPanelProps) {
  const {
    addMenu,
    availableTemplates,
    expanded,
    page,
    path,
    problems,
    readOnly,
    selected,
    tab,
    onAddBlock,
    onChange,
    onDeleteRequest,
    onEditBlock,
    onMoveBlock,
    onRemoveBlock,
    onSelectBlock,
    onSelectTab,
    onShowToast,
    onToggleAddMenu,
    onToggleExpanded,
  } = props;

  return (
    <aside
      aria-label={readOnly ? "Published page details (read-only)" : "Concept page editor"}
      className={`sc-editor-panel [display:flex] [min-height:0] [width:404px] [flex:none] [flex-direction:column] bg-surface [border-left:1px_solid_var(--sc-border)] max-[1000px]:[width:370px] max-[760px]:[position:absolute] max-[760px]:[top:0] max-[760px]:[right:0] max-[760px]:[bottom:0] max-[760px]:[z-index:10] max-[760px]:[width:min(404px,_92vw)] max-[760px]:[box-shadow:-8px_0_26px_rgba(23,_35,_38,_0.15)] dark:[border-color:#323841] dark:[background:#1d2126] ${readOnly ? "readonly" : ""}`}
    >
      <div className="sc-editor-tabs [display:flex] [flex:none] [gap:2px] [padding:8px_12px_0] [border-bottom:1px_solid_var(--sc-sunken)] dark:[border-color:#323841] [&_b]:[display:inline-flex] [&_b]:[height:16px] [&_b]:[min-width:16px] [&_b]:[align-items:center] [&_b]:[justify-content:center] [&_b]:[border-radius:999px] [&_b]:bg-concept-soft [&_b]:[padding:0_4px] [&_b]:[font-size:10px] [&_b]:text-concept [&_button]:[margin-bottom:-1px] [&_button]:[display:inline-flex] [&_button]:[cursor:pointer] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[padding:8px_12px_10px] [&_button]:[font-size:13px] [&_button]:[font-weight:600] [&_button]:text-ink-muted [&_button]:[background:transparent] [&_button]:[border-bottom:2px_solid_transparent] [&_button]:[border:0] dark:[&_button]:[color:#a7aeb8] [&_button.active]:border-action [&_button.active]:text-action dark:[&_button.active]:[color:#b994f8]">
        <Button
          unstyled
          className={tab === "content" ? "active" : ""}
          onClick={() => onSelectTab("content")}
        >
          Content
        </Button>
        <Button
          unstyled
          className={tab === "seo" ? "active" : ""}
          onClick={() => onSelectTab("seo")}
        >
          SEO{problems.length > 0 && <b>{problems.length}</b>}
        </Button>
        <Button
          unstyled
          className={tab === "settings" ? "active" : ""}
          onClick={() => onSelectTab("settings")}
        >
          Page information
        </Button>
      </div>
      <div
        className={`sc-editor-fields sc-scroll [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [overflow:auto] [padding:16px] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff] ${readOnly ? "[pointer-events:none] [opacity:0.78]" : ""}`}
      >
        {tab === "content" && (
          <ContentTab
            addMenu={addMenu}
            expanded={expanded}
            page={page}
            selected={selected}
            onAddBlock={onAddBlock}
            onEditBlock={onEditBlock}
            onMoveBlock={onMoveBlock}
            onRemoveBlock={onRemoveBlock}
            onSelectBlock={onSelectBlock}
            onToggleAddMenu={onToggleAddMenu}
            onToggleExpanded={onToggleExpanded}
          />
        )}
        {tab === "seo" && (
          <SeoTab
            page={page}
            path={path}
            problems={problems}
            onChange={onChange}
            onShowToast={onShowToast}
          />
        )}
        {tab === "settings" && (
          <SettingsTab
            availableTemplates={availableTemplates}
            page={page}
            path={path}
            onChange={onChange}
            onDeleteRequest={onDeleteRequest}
            onShowToast={onShowToast}
          />
        )}
      </div>
    </aside>
  );
}
