import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "../lib/utils";

const splashMessages = ["Connecting to your workspace…", "Loading content tree…", "Almost there…"];

const navigationRows = ["40px", "48px", "62px", "110px", "50px", "120px", "58px"];
const rowWidths = ["58%", "72%", "44%", "66%", "51%", "78%", "40%", "63%", "70%"];
const headerWidths = ["70%", "60%", "55%", "70%", "60%"];

function Shimmer({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`sf-shimmer [display:block] [flex:none] [animation:sf-loading-shimmer_1.35s_linear_infinite] [border-radius:5px] [background-image:linear-gradient(_90deg,_var(--sf-skeleton)_0,_var(--sf-skeleton-highlight)_44px,_var(--sf-skeleton)_88px_)] [background-size:600px_100%] motion-reduce:[animation:none] [&.invisible]:[visibility:hidden] [&.round]:[border-radius:999px] ${className}`}
      style={style}
    />
  );
}

export function LoadingSplash({ messages = splashMessages }: { messages?: string[] }) {
  const availableMessages = messages.length ? messages : splashMessages;
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setMessageIndex((current) => (current + 1) % availableMessages.length),
      1500,
    );
    return () => window.clearInterval(timer);
  }, [availableMessages.length]);

  return (
    <main
      aria-live="polite"
      className="sf-loading-splash [position:relative] [display:flex] [height:100vh] [width:100vw] [align-items:center] [justify-content:center] [overflow:hidden] bg-canvas text-ink"
      data-testid="loading-splash"
      role="status"
    >
      <span
        aria-hidden="true"
        className="sf-loading-wash top [pointer-events:none] [position:absolute] [height:360px] [width:360px] [border-radius:999px] [&.bottom]:[bottom:-140px] [&.bottom]:[left:-100px] [&.bottom]:[height:340px] [&.bottom]:[width:340px] [&.bottom]:[background:radial-gradient(circle,_rgba(118,_63,_186,_0.09),_transparent_68%)] dark:[&.bottom]:[background:radial-gradient(circle,_rgba(139,_92,_246,_0.12),_transparent_68%)] [&.top]:[top:-120px] [&.top]:[right:-120px] [&.top]:[background:radial-gradient(circle,_rgba(224,_122,_79,_0.1),_transparent_68%)]"
      />
      <span
        aria-hidden="true"
        className="sf-loading-wash bottom [pointer-events:none] [position:absolute] [height:360px] [width:360px] [border-radius:999px] [&.bottom]:[bottom:-140px] [&.bottom]:[left:-100px] [&.bottom]:[height:340px] [&.bottom]:[width:340px] [&.bottom]:[background:radial-gradient(circle,_rgba(118,_63,_186,_0.09),_transparent_68%)] dark:[&.bottom]:[background:radial-gradient(circle,_rgba(139,_92,_246,_0.12),_transparent_68%)] [&.top]:[top:-120px] [&.top]:[right:-120px] [&.top]:[background:radial-gradient(circle,_rgba(224,_122,_79,_0.1),_transparent_68%)]"
      />
      <div className="sf-loading-splash-content [z-index:1] [display:flex] [flex-direction:column] [align-items:center] [gap:26px]">
        <div
          aria-hidden="true"
          className="sf-loading-brand-ring [position:relative] [display:flex] [height:104px] [width:104px] [align-items:center] [justify-content:center] [&_.progress]:[stroke:var(--sf-accent)] [&_.track]:[stroke:var(--sf-ring-track)] [&>svg]:[position:absolute] [&>svg]:[inset:0] [&>svg]:[height:104px] [&>svg]:[width:104px] [&>svg]:[animation:sf-loading-spin_1.5s_linear_infinite] motion-reduce:[&>svg]:[animation:none]"
        >
          <span className="sf-loading-halo [position:absolute] [inset:0] [animation:sf-loading-halo_2.4s_ease-in-out_infinite] [border-radius:999px] [background:radial-gradient(circle,_var(--sf-focus-ring),_transparent_70%)] motion-reduce:[animation:none]" />
          <svg viewBox="0 0 104 104">
            <circle className="track" cx="52" cy="52" fill="none" r="47" strokeWidth="3" />
            <circle
              className="progress"
              cx="52"
              cy="52"
              fill="none"
              r="47"
              strokeDasharray="70 230"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
          <span className="sf-loading-brand-mark [z-index:1] [display:grid] [height:66px] [width:66px] [animation:sf-loading-brand-breathe_2.4s_ease-in-out_infinite] [place-items:center] [border-radius:17px] bg-clay [color:#fff] [box-shadow:0_8px_26px_rgba(224,_122,_79,_0.32)] motion-reduce:[animation:none] [&_i]:[font-size:32px]">
            <i className="ph-bold ph-hammer" />
          </span>
        </div>
        <div className="sf-loading-wordmark [display:flex] [animation:sf-loading-fade-up_0.5s_ease_both_0.15s] [flex-direction:column] [align-items:center] [gap:7px] motion-reduce:[animation:none] [&_span]:[font-size:13px] [&_span]:text-ink-subtle [&_strong]:[font-size:23px] [&_strong]:[font-weight:600] [&_strong]:[letter-spacing:-0.02em]">
          <strong>SiteFoundry</strong>
          <span>{availableMessages[messageIndex % availableMessages.length]}</span>
        </div>
        <LoadingBar />
      </div>
      <small className="sf-loading-license sf-mono [position:absolute] [right:0] [bottom:24px] [left:0] [text-align:center] [font-family:'Geist_Mono',_monospace] [font-size:11.5px] [color:color-mix(in_srgb,_var(--sf-ink-3)_72%,_transparent)]">
        Open source · self-hosted
      </small>
    </main>
  );
}

export function AppShellSkeleton({
  active = "pages",
  variant,
  label,
}: {
  active?: "pages" | "media" | "redirects" | "header-navigation" | "footer" | "structured-content";
  variant: "tree" | "table";
  label: string;
}) {
  const activeIndex = {
    pages: 0,
    media: 1,
    redirects: 2,
    "header-navigation": 3,
    footer: 4,
    "structured-content": 5,
  }[active];

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="sf-loading-shell [display:flex] [height:100vh] [width:100vw] [animation:sf-loading-fade-up_0.3s_ease_both] [overflow:hidden] bg-canvas [border-top:6px_solid_#2b2b2b] motion-reduce:[animation:none]"
      data-testid={`${variant}-skeleton`}
      role="status"
    >
      <span className="sr-only">{label}</span>
      <aside
        aria-hidden="true"
        className="sf-loading-rail [display:flex] [width:244px] [flex:0_0_244px] [flex-direction:column] [background:color-mix(in_srgb,_var(--sf-canvas)_68%,_var(--sf-surface))] [border-right:1px_solid_var(--sf-border)]"
      >
        <div className="sf-loading-site-card [margin:14px_14px_8px] [display:flex] [height:46px] [align-items:center] [gap:10px] [border-radius:10px] bg-surface [padding:0_10px] [border:1px_solid_var(--sf-border)]">
          <span className="sf-loading-site-mark [display:grid] [height:28px] [width:28px] [flex:none] [place-items:center] [border-radius:7px] bg-clay [color:#fff]">
            <i className="ph-bold ph-hammer" />
          </span>
          <span className="sf-loading-site-copy [display:flex] [flex:1] [flex-direction:column] [gap:4px]">
            <Shimmer style={{ height: 9, width: "78%" }} />
            <Shimmer style={{ height: 7, width: "42%" }} />
          </span>
        </div>
        <div className="sf-loading-nav-label [padding:14px_16px_4px]">
          <Shimmer style={{ height: 8, width: 52 }} />
        </div>
        <div className="sf-loading-nav [display:flex] [flex-direction:column] [gap:5px] [padding:6px_10px] [&>div]:[display:flex] [&>div]:[height:34px] [&>div]:[align-items:center] [&>div]:[gap:11px] [&>div]:[border-radius:8px] [&>div]:[padding:0_10px] [&>div.active]:bg-sunken">
          {navigationRows.map((width, index) => (
            <div className={index === activeIndex ? "active" : ""} key={`${width}-${index}`}>
              <Shimmer style={{ height: 17, width: 17 }} />
              <Shimmer style={{ height: 9, width }} />
            </div>
          ))}
        </div>
      </aside>
      <main
        aria-hidden="true"
        className="sf-loading-shell-main [display:flex] [min-width:0] [flex:1] [flex-direction:column] bg-surface"
      >
        <header className="sf-loading-shell-header [display:flex] [align-items:center] [gap:13px] [padding:16px_22px_15px] [border-bottom:1px_solid_var(--sf-sunken)]">
          <span className="sf-loading-heading [display:flex] [flex:none] [flex-direction:column] [gap:7px]">
            <Shimmer style={{ height: 15, width: 150 }} />
            <Shimmer style={{ height: 9, width: 230 }} />
          </span>
          <span className="sf-loading-header-spacer [flex:1]" />
          <Shimmer style={{ height: 36, width: 240 }} />
          <Shimmer style={{ height: 36, width: 120 }} />
        </header>
        {variant === "tree" ? <TreeSkeletonRows /> : <TableSkeletonRows />}
      </main>
    </div>
  );
}

function TreeSkeletonRows() {
  return (
    <div className="sf-loading-tree-rows [padding:8px_0] [&>div]:[display:flex] [&>div]:[height:44px] [&>div]:[align-items:center] [&>div]:[gap:11px] [&>div]:[padding-right:22px] [&>div>span:nth-last-child(2)]:[flex:1]">
      {Array.from({ length: 10 }, (_, index) => {
        const child = index % 3 === 1 || index % 5 === 3;
        return (
          <div key={index} style={{ opacity: 1 - index * 0.06, paddingLeft: child ? 48 : 22 }}>
            <Shimmer className={child ? "invisible" : ""} style={{ height: 14, width: 14 }} />
            <Shimmer style={{ height: 22, width: 22 }} />
            <Shimmer style={{ height: 11, width: rowWidths[index] }} />
            <span />
            <Shimmer style={{ height: 20, width: 78 }} />
          </div>
        );
      })}
    </div>
  );
}

function TableSkeletonRows() {
  return (
    <div className="sf-loading-table">
      <div className="sf-loading-table-head [display:grid] [grid-template-columns:2fr_1.2fr_1fr_110px_90px] [gap:16px] [padding:11px_22px] [border-bottom:1px_solid_var(--sf-border)]">
        {headerWidths.map((width, index) => (
          <Shimmer key={`${width}-${index}`} style={{ height: 8, width }} />
        ))}
      </div>
      {Array.from({ length: 9 }, (_, index) => (
        <div
          className="sf-loading-table-row [display:grid] [height:56px] [grid-template-columns:2fr_1.2fr_1fr_110px_90px] [align-items:center] [gap:16px] [border-color:var(--sf-sunken)] [padding:0_22px] [border-bottom:1px_solid_var(--sf-border)] [&>span:first-child]:[display:flex] [&>span:first-child]:[min-width:0] [&>span:first-child]:[align-items:center] [&>span:first-child]:[gap:12px]"
          key={index}
          style={{ opacity: 1 - index * 0.07 }}
        >
          <span>
            <Shimmer className="round" style={{ height: 32, width: 32 }} />
            <Shimmer style={{ height: 11, width: rowWidths[index] }} />
          </span>
          <Shimmer style={{ height: 10, width: rowWidths[(index + 3) % rowWidths.length] }} />
          <Shimmer style={{ height: 10, width: rowWidths[(index + 5) % rowWidths.length] }} />
          <Shimmer style={{ height: 22, width: 84 }} />
          <Shimmer style={{ height: 10, width: 60 }} />
        </div>
      ))}
    </div>
  );
}

export function RouteLoading({ title, detail }: { title: string; detail?: string }) {
  return (
    <div
      aria-live="polite"
      className="sf-route-loading [display:flex] [height:100%] [min-height:0] [width:100%] [flex:1] [flex-direction:column] [align-items:center] [justify-content:center] [gap:10px] bg-surface text-ink-muted [&_small]:[font-size:11.5px] [&_small]:text-ink-subtle [&_strong]:[margin-top:6px] [&_strong]:[font-size:13.5px] [&_strong]:text-ink"
      role="status"
    >
      <InlineSpinner />
      <strong>{title}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function InlineSpinner({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "sf-inline-spinner [display:inline-block] [height:42px] [width:42px] [flex:none] [animation:sf-loading-spin_0.9s_linear_infinite] [border-radius:999px] [border-top-color:var(--sf-accent)] [border:4px_solid_var(--sf-ring-track)] motion-reduce:[animation:none] [&.small]:[height:15px] [&.small]:[width:15px] [&.small]:[border-width:2px]",
        small && "small",
      )}
    />
  );
}

export function LoadingDots() {
  return (
    <span
      aria-hidden="true"
      className="sf-loading-dots [display:inline-flex] [height:14px] [align-items:flex-end] [gap:7px] [&_i]:[height:9px] [&_i]:[width:9px] [&_i]:[animation:sf-loading-dot_1.2s_ease-in-out_infinite] [&_i]:[border-radius:999px] [&_i]:bg-action motion-reduce:[&_i]:[animation:none] [&_i:nth-child(2)]:[animation-delay:0.15s] [&_i:nth-child(3)]:[animation-delay:0.3s]"
    >
      <i />
      <i />
      <i />
    </span>
  );
}

export function LoadingBar() {
  return (
    <span
      aria-hidden="true"
      className="sf-loading-bar [position:relative] [margin-top:2px] [display:block] [height:4px] [width:220px] [overflow:hidden] [border-radius:999px] [background:var(--sf-loading-track)] [&_i]:[position:absolute] [&_i]:[top:0] [&_i]:[bottom:0] [&_i]:[animation:sf-loading-bar_1.5s_cubic-bezier(0.65,_0.02,_0.35,_1)_infinite] [&_i]:[border-radius:inherit] [&_i]:bg-action motion-reduce:[&_i]:[animation:none]"
    >
      <i />
    </span>
  );
}
