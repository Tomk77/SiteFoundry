import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import type { Device } from "../editor-model";

export function HeaderPreview({
  items,
  device,
  selected,
  previewGroup,
  mobileOpen,
  mobileGroups,
  onSelect,
  onPreviewGroup,
  onMobileToggle,
  onGroupToggle,
}: {
  items: NavigationItem[];
  device: Device;
  selected: string | null;
  previewGroup: string | null;
  mobileOpen: boolean;
  mobileGroups: Set<string>;
  onSelect: (id: string) => void;
  onPreviewGroup: (id: string | null) => void;
  onMobileToggle: () => void;
  onGroupToggle: (id: string) => void;
}) {
  if (device === "mobile") {
    return (
      <div className="sc-mobile-header-preview [min-height:420px] [&_.ph-caret-down]:[transition:transform_150ms_ease] [&_.ph-caret-down.open]:[transform:rotate(180deg)] [&_nav]:[display:flex] [&_nav]:[flex-direction:column] [&_nav]:[gap:3px] [&_nav]:[padding:12px] [&_nav_button]:[display:flex] [&_nav_button]:[height:48px] [&_nav_button]:[cursor:pointer] [&_nav_button]:[align-items:center] [&_nav_button]:[justify-content:space-between] [&_nav_button]:[border-radius:9px] [&_nav_button]:[padding:0_13px] [&_nav_button]:[text-align:left] [&_nav_button]:[font-size:15px] [&_nav_button]:[color:#141a2e] [&_nav_button]:[background:transparent] [&_nav_button]:[border:0] [&_nav_button.child]:[height:42px] [&_nav_button.child]:[padding-left:24px] [&_nav_button.child]:[color:#4a5064] [&_nav_button.cta]:[margin-top:8px] [&_nav_button.cta]:[justify-content:center] [&_nav_button.cta]:[font-weight:600] [&_nav_button.cta]:[color:#fff] [&_nav_button.cta]:[background:#2f5fe0] [&_nav_button.selected]:bg-selection [&_nav_button.selected]:[box-shadow:inset_0_0_0_1.5px_var(--sc-selection-rail)] [&>.sc-preview-brand]:[height:58px] [&>.sc-preview-brand]:[padding:0_18px] [&>.sc-preview-brand]:[border-bottom:1px_solid_#edeff2] [&>.sc-preview-brand_button]:[display:grid] [&>.sc-preview-brand_button]:[height:38px] [&>.sc-preview-brand_button]:[width:38px] [&>.sc-preview-brand_button]:[cursor:pointer] [&>.sc-preview-brand_button]:[place-items:center] [&>.sc-preview-brand_button]:[border-radius:9px] [&>.sc-preview-brand_button]:[font-size:22px] [&>.sc-preview-brand_button]:[background:transparent] [&>.sc-preview-brand_button]:[border:0]">
        <div className="sc-preview-brand [display:flex] [flex:none] [align-items:center] [gap:9px] [&_strong]:[font-size:16px] [&_strong]:[font-weight:700]">
          <Logo /> <strong>Acme</strong>
          <span className="sc-spacer [flex:1]" />
          <Button unstyled onClick={onMobileToggle} type="button">
            <i className={`ph-bold ${mobileOpen ? "ph-x" : "ph-list"}`} />
          </Button>
        </div>
        {mobileOpen ? (
          <nav>
            {items.map((item) =>
              item.kind === "group" ? (
                <div key={item.id}>
                  <Button
                    unstyled
                    className={selected === item.id ? "selected" : ""}
                    onClick={() => {
                      onSelect(item.id);
                      onGroupToggle(item.id);
                    }}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <i
                      className={cn("ph-bold ph-caret-down", mobileGroups.has(item.id) && "open")}
                    />
                  </Button>
                  {mobileGroups.has(item.id)
                    ? item.children.map((child) => (
                        <Button
                          unstyled
                          className={cn("child", selected === child.id && "selected")}
                          key={child.id}
                          onClick={() => onSelect(child.id)}
                          type="button"
                        >
                          {child.label}
                        </Button>
                      ))
                    : null}
                </div>
              ) : (
                <Button
                  unstyled
                  className={cn(
                    item.kind === "button" && "cta",
                    selected === item.id && "selected",
                  )}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  {item.label}
                </Button>
              ),
            )}
          </nav>
        ) : null}
      </div>
    );
  }

  return (
    <div className="sc-desktop-header-preview [position:relative] [min-height:252px] [&_nav_button]:[cursor:pointer] [&_nav_button]:[background:transparent] [&_nav_button]:[border:0] [&>header]:[display:flex] [&>header]:[height:66px] [&>header]:[align-items:center] [&>header]:[gap:28px] [&>header]:[padding:0_28px] [&>header]:[border-bottom:1px_solid_#edeff2] [&>header_nav]:[display:flex] [&>header_nav]:[min-width:0] [&>header_nav]:[flex:1] [&>header_nav]:[align-items:center] [&>header_nav]:[justify-content:flex-end] [&>header_nav]:[gap:4px] [&>header_nav]:[overflow-x:auto] [&>header_nav_button]:[display:inline-flex] [&>header_nav_button]:[height:38px] [&>header_nav_button]:[flex:none] [&>header_nav_button]:[align-items:center] [&>header_nav_button]:[gap:5px] [&>header_nav_button]:[border-radius:8px] [&>header_nav_button]:[padding:0_13px] [&>header_nav_button]:[font-size:14px] [&>header_nav_button]:[font-weight:500] [&>header_nav_button]:[white-space:nowrap] [&>header_nav_button]:[color:#141a2e] [&>header_nav_button.cta]:[margin-left:10px] [&>header_nav_button.cta]:[padding:0_17px] [&>header_nav_button.cta]:[font-weight:600] [&>header_nav_button.cta]:[color:#fff] [&>header_nav_button.cta]:[background:#2f5fe0] [&>header_nav_button.selected]:bg-selection [&>header_nav_button.selected]:[box-shadow:inset_0_0_0_1.5px_var(--sc-selection-rail)]">
      <header>
        <div className="sc-preview-brand [display:flex] [flex:none] [align-items:center] [gap:9px] [&_strong]:[font-size:16px] [&_strong]:[font-weight:700]">
          <Logo />
          <strong>Acme</strong>
        </div>
        <nav className="sc-scroll [scrollbar-width:thin] [scrollbar-color:#cfd6d0_transparent] [&::-webkit-scrollbar]:[height:10px] [&::-webkit-scrollbar]:[width:10px] [&::-webkit-scrollbar-thumb]:[border-radius:8px] [&::-webkit-scrollbar-thumb]:[background:#d7ddd8] [&::-webkit-scrollbar-thumb]:[border:3px_solid_#fff]">
          {items.map((item) => (
            <Button
              unstyled
              className={cn(item.kind === "button" && "cta", selected === item.id && "selected")}
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                if (item.kind === "group")
                  onPreviewGroup(previewGroup === item.id ? null : item.id);
              }}
              type="button"
            >
              {item.label}
              {item.kind === "group" ? <i className="ph-bold ph-caret-down" /> : null}
            </Button>
          ))}
        </nav>
      </header>
      {previewGroup ? (
        <div className="sc-preview-dropdown [position:absolute] [top:58px] [right:120px] [z-index:4] [display:grid] [width:230px] [gap:2px] [border-radius:10px] bg-surface [padding:8px] [box-shadow:0_14px_32px_rgb(23_35_38_/_15%)] [border:1px_solid_var(--sc-border)] [&_button]:[display:flex] [&_button]:[cursor:pointer] [&_button]:[flex-direction:column] [&_button]:[gap:2px] [&_button]:[border-radius:7px] [&_button]:[padding:9px_10px] [&_button]:[text-align:left] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.selected]:bg-selection [&_button:hover]:bg-selection [&_span]:[font-size:10px] [&_span]:text-ink-subtle">
          {items
            .find((item) => item.id === previewGroup)
            ?.children.map((child) => (
              <Button
                unstyled
                className={selected === child.id ? "selected" : ""}
                key={child.id}
                onClick={() => onSelect(child.id)}
                type="button"
              >
                {child.label}
                <span className="sc-mono [font-family:'Geist_Mono',_monospace]">
                  {child.target}
                </span>
              </Button>
            ))}
        </div>
      ) : null}
      <PreviewSkeleton />
    </div>
  );
}

export function FooterPreview({
  items,
  device,
  selected,
  onSelect,
}: {
  items: NavigationItem[];
  device: Device;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = items.filter((item) => item.kind === "group");
  const buttons = items.filter((item) => item.kind === "button");
  const links = items.filter((item) => item.kind === "link");

  return (
    <div
      className={`sc-footer-preview [min-height:458px] [&_.sc-preview-skeleton]:[min-height:124px] [&_footer]:[margin:0] [&_footer]:[padding:38px_40px_26px] [&_footer]:[color:#fff] [&_footer]:[background:#141a2e] [&.mobile_.sc-footer-bottom]:[flex-direction:column] [&.mobile_.sc-footer-bottom]:[align-items:flex-start] [&.mobile_.sc-footer-bottom_nav]:[margin-left:0] [&.mobile_.sc-footer-main]:[display:flex] [&.mobile_.sc-footer-main]:[flex-direction:column] [&.mobile_.sc-footer-main]:[gap:28px] [&.mobile_footer]:[padding:30px_26px] ${device}`}
    >
      <PreviewSkeleton />
      <footer>
        <div className="sc-footer-main [display:grid] [grid-template-columns:minmax(230px,_1.3fr)_repeat(3,_1fr)] [gap:38px]">
          <div className="sc-footer-brand [display:flex] [flex-direction:column] [align-items:flex-start] [gap:16px] [&_p]:[margin:0] [&_p]:[max-width:290px] [&_p]:[font-size:13px] [&_p]:[line-height:1.6] [&_p]:[color:#aeb4c6] [&>button]:[height:40px] [&>button]:[cursor:pointer] [&>button]:[border-radius:9px] [&>button]:[padding:0_18px] [&>button]:[font-weight:600] [&>button]:[color:#fff] [&>button]:[background:#2f5fe0] [&>button]:[border:1.5px_solid_#2f5fe0] [&>button.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&>button.selected]:[background:rgb(78_123_240_/_20%)]">
            <div className="sc-preview-brand [display:flex] [flex:none] [align-items:center] [gap:9px] [&_strong]:[font-size:16px] [&_strong]:[font-weight:700]">
              <Logo />
              <strong>Acme</strong>
            </div>
            <p>The website-native, open-source CMS for teams who care about their URLs.</p>
            <div className="sc-socials [display:flex] [gap:8px] [&_i]:[display:grid] [&_i]:[height:32px] [&_i]:[width:32px] [&_i]:[place-items:center] [&_i]:[border-radius:8px] [&_i]:[color:#aeb4c6] [&_i]:[background:rgb(255_255_255_/_8%)]">
              <i className="ph ph-x-logo" />
              <i className="ph ph-github-logo" />
              <i className="ph ph-linkedin-logo" />
            </div>
            {buttons.map((item) => (
              <Button
                unstyled
                className={selected === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                {item.label}
              </Button>
            ))}
          </div>
          {groups.map((group) => (
            <div
              className={cn(
                "sc-footer-column [display:flex] [flex-direction:column] [align-items:flex-start] [gap:10px] [border-radius:8px] [padding:5px] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[color:#aeb4c6] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&_button.selected]:[background:rgb(78_123_240_/_20%)] [&.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&.selected]:[background:rgb(78_123_240_/_20%)] [&>strong]:[margin-bottom:3px] [&>strong]:[font-size:12px] [&>strong]:[font-weight:500] [&>strong]:[letter-spacing:0.04em] [&>strong]:[color:#9eb5f0] [&>strong]:[text-transform:uppercase]",
                selected === group.id && "selected",
              )}
              key={group.id}
            >
              <Button unstyled onClick={() => onSelect(group.id)} type="button">
                <strong>{group.label}</strong>
              </Button>
              {group.children.map((child) => (
                <Button
                  unstyled
                  className={selected === child.id ? "selected" : ""}
                  key={child.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(child.id);
                  }}
                  type="button"
                >
                  {child.label}
                </Button>
              ))}
            </div>
          ))}
        </div>
        <div className="sc-footer-bottom [margin-top:28px] [display:flex] [align-items:center] [gap:16px] [padding-top:22px] [font-size:12px] [color:#8891a6] [border-top:1px_solid_rgb(255_255_255_/_12%)] [&_button]:[cursor:pointer] [&_button]:[padding:0] [&_button]:[color:#aeb4c6] [&_button]:[background:transparent] [&_button]:[border:0] [&_button.selected]:[box-shadow:0_0_0_1.5px_#4e7bf0] [&_button.selected]:[background:rgb(78_123_240_/_20%)] [&_nav]:[margin-left:auto] [&_nav]:[display:flex] [&_nav]:[gap:24px]">
          <span>© 2026 Acme Marketing. All rights reserved.</span>
          <nav>
            {links.map((item) => (
              <Button
                unstyled
                className={selected === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="sc-preview-logo [display:grid] [height:28px] [width:28px] [place-items:center] [border-radius:7px] bg-clay [color:#fff]">
      <i className="ph-bold ph-hammer" />
    </span>
  );
}

function PreviewSkeleton() {
  return (
    <div className="sc-preview-skeleton [display:flex] [flex-direction:column] [gap:12px] [padding:40px_28px] [&_span]:[height:12px] [&_span]:[border-radius:999px] [&_span]:[background:#edf0f3] [&_span:nth-child(1)]:[width:42%] [&_span:nth-child(2)]:[width:70%] [&_span:nth-child(3)]:[width:55%]">
      <span />
      <span />
      <span />
    </div>
  );
}
