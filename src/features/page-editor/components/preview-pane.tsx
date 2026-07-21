import { Button } from "@/components/ui/button";
import type { RefObject } from "react";

import type { Device } from "../editor-model";

interface PreviewPaneProps {
  device: Device;
  deviceWidth: string;
  path: string;
  previewKey: number;
  previewRef: RefObject<HTMLIFrameElement | null>;
  refreshing: boolean;
  srcDoc: string;
  onDeviceChange: (device: Device) => void;
  onOpenPreview: () => void;
  onRefresh: () => void;
}

export function PreviewPane({
  device,
  deviceWidth,
  path,
  previewKey,
  previewRef,
  refreshing,
  srcDoc,
  onDeviceChange,
  onOpenPreview,
  onRefresh,
}: PreviewPaneProps) {
  return (
    <section className="sf-preview-pane [display:flex] [min-width:0] [flex:1] [flex-direction:column] bg-sunken dark:[background:#15181c]">
      <div className="sf-preview-tools [display:flex] [height:48px] [flex:none] [align-items:center] [gap:12px] [padding:0_16px] [background:#fafcfa] [border-bottom:1px_solid_var(--sf-border)] dark:[border-color:#323841] dark:[background:#1d2126] [&>button]:[display:grid] [&>button]:[height:32px] [&>button]:[width:32px] [&>button]:[cursor:pointer] [&>button]:[place-items:center] [&>button]:[border-radius:6px] [&>button]:[font-size:16px] [&>button]:text-ink-muted [&>button]:[background:transparent] [&>button]:[border:0] [&>button.spin_i]:[animation:sf-editor-spin_0.55s_linear_infinite] [&>button:hover]:bg-sunken [&>button:hover]:text-ink dark:[&>button:hover]:[color:#e9ecf1] dark:[&>button:hover]:[background:#242930]">
        <div className="sf-device-toggle [display:flex] [gap:2px] [border-radius:8px] [padding:2px] [background:#eaeeea] dark:[background:#15181c] [&_button]:[display:grid] [&_button]:[height:28px] [&_button]:[width:30px] [&_button]:[cursor:pointer] [&_button]:[place-items:center] [&_button]:[border-radius:6px] [&_button]:[font-size:16px] [&_button]:text-ink-subtle [&_button]:[background:transparent] [&_button]:[border:0] [&_button.active]:bg-surface [&_button.active]:text-action [&_button.active]:[box-shadow:0_1px_2px_rgba(23,_35,_38,_0.14)] dark:[&_button.active]:[color:#b994f8] dark:[&_button.active]:[box-shadow:none] dark:[&_button.active]:[background:#2c333b]">
          {(
            [
              ["desktop", "ph-monitor", "Desktop"],
              ["tablet", "ph-device-tablet", "Tablet"],
              ["mobile", "ph-device-mobile", "Mobile"],
            ] as const
          ).map(([id, icon, label]) => (
            <Button
              unstyled
              className={device === id ? "active" : ""}
              title={label}
              onClick={() => onDeviceChange(id)}
              key={id}
            >
              <i className={`ph-bold ${icon}`} />
            </Button>
          ))}
        </div>
        <div className="sf-preview-url [display:flex] [height:32px] [max-width:440px] [min-width:0] [flex:1] [align-items:center] [gap:8px] [border-radius:999px] bg-surface [padding:0_12px] [border:1px_solid_var(--sf-border)] dark:[border-color:#3d444e] dark:[color:#e9ecf1] dark:[background:#1d2126] [&>b]:[border-radius:999px] [&>b]:bg-concept-soft [&>b]:[padding:1px_6px] [&>b]:[font-size:10px] [&>b]:text-concept [&>i]:[font-size:12px] [&>i]:[color:#1f9d57] [&>span]:[flex:1] [&>span]:[overflow:hidden] [&>span]:[text-overflow:ellipsis] [&>span]:[white-space:nowrap] [&>span]:text-ink-muted [&>span]:[font:12px_'Geist_Mono'] dark:[&>span]:[color:#a7aeb8]">
          <i className="ph-fill ph-lock-simple" />
          <span>acme.com{path}</span>
          <b>Preview</b>
        </div>
        <Button
          unstyled
          className={refreshing ? "spin" : ""}
          title="Refresh preview"
          onClick={onRefresh}
        >
          <i className="ph ph-arrow-clockwise" />
        </Button>
        <Button unstyled title="Open preview" onClick={onOpenPreview}>
          <i className="ph ph-arrow-square-out" />
        </Button>
      </div>
      <div className="sf-preview-stage sf-scroll [display:flex] [flex:1] [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [align-items:flex-start] [justify-content:center] [overflow:auto] [padding:24px] dark:[background:#15181c] [&_iframe]:[height:100%] [&_iframe]:[min-height:100%] [&_iframe]:[max-width:100%] [&_iframe]:bg-surface [&_iframe]:[box-shadow:0_8px_30px_rgba(23,_35,_38,_0.12)] [&_iframe]:[border:0] [&_iframe]:[transition:width_0.2s_ease] dark:[&_iframe]:[box-shadow:0_12px_36px_rgb(0_0_0_/_32%)] dark:[&_iframe]:[outline:1px_solid_#323841] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
        <iframe
          ref={previewRef}
          key={previewKey}
          title="Live page preview"
          srcDoc={srcDoc}
          style={{
            width: deviceWidth,
            borderRadius: device === "desktop" ? 6 : 14,
          }}
        />
      </div>
    </section>
  );
}
