import { useEffect, useState, type CSSProperties } from "react";

const splashMessages = ["Connecting to your workspace…", "Loading content tree…", "Almost there…"];

const navigationRows = ["40px", "48px", "62px", "110px", "50px", "120px", "58px"];
const rowWidths = ["58%", "72%", "44%", "66%", "51%", "78%", "40%", "63%", "70%"];
const headerWidths = ["70%", "60%", "55%", "70%", "60%"];

function Shimmer({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`sf-shimmer ${className}`} style={style} />;
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
      className="sf-loading-splash"
      data-testid="loading-splash"
      role="status"
    >
      <span aria-hidden="true" className="sf-loading-wash top" />
      <span aria-hidden="true" className="sf-loading-wash bottom" />
      <div className="sf-loading-splash-content">
        <div aria-hidden="true" className="sf-loading-brand-ring">
          <span className="sf-loading-halo" />
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
          <span className="sf-loading-brand-mark">
            <i className="ph-bold ph-hammer" />
          </span>
        </div>
        <div className="sf-loading-wordmark">
          <strong>SiteFoundry</strong>
          <span>{availableMessages[messageIndex % availableMessages.length]}</span>
        </div>
        <LoadingBar />
      </div>
      <small className="sf-loading-license sf-mono">Open source · self-hosted</small>
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
      className="sf-loading-shell"
      data-testid={`${variant}-skeleton`}
      role="status"
    >
      <span className="sr-only">{label}</span>
      <aside aria-hidden="true" className="sf-loading-rail">
        <div className="sf-loading-site-card">
          <span className="sf-loading-site-mark">
            <i className="ph-bold ph-hammer" />
          </span>
          <span className="sf-loading-site-copy">
            <Shimmer style={{ height: 9, width: "78%" }} />
            <Shimmer style={{ height: 7, width: "42%" }} />
          </span>
        </div>
        <div className="sf-loading-nav-label">
          <Shimmer style={{ height: 8, width: 52 }} />
        </div>
        <div className="sf-loading-nav">
          {navigationRows.map((width, index) => (
            <div className={index === activeIndex ? "active" : ""} key={`${width}-${index}`}>
              <Shimmer style={{ height: 17, width: 17 }} />
              <Shimmer style={{ height: 9, width }} />
            </div>
          ))}
        </div>
      </aside>
      <main aria-hidden="true" className="sf-loading-shell-main">
        <header className="sf-loading-shell-header">
          <span className="sf-loading-heading">
            <Shimmer style={{ height: 15, width: 150 }} />
            <Shimmer style={{ height: 9, width: 230 }} />
          </span>
          <span className="sf-loading-header-spacer" />
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
    <div className="sf-loading-tree-rows">
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
      <div className="sf-loading-table-head">
        {headerWidths.map((width, index) => (
          <Shimmer key={`${width}-${index}`} style={{ height: 8, width }} />
        ))}
      </div>
      {Array.from({ length: 9 }, (_, index) => (
        <div className="sf-loading-table-row" key={index} style={{ opacity: 1 - index * 0.07 }}>
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
    <div aria-live="polite" className="sf-route-loading" role="status">
      <InlineSpinner />
      <strong>{title}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function InlineSpinner({ small = false }: { small?: boolean }) {
  return <span aria-hidden="true" className={`sf-inline-spinner${small ? " small" : ""}`} />;
}

export function LoadingDots() {
  return (
    <span aria-hidden="true" className="sf-loading-dots">
      <i />
      <i />
      <i />
    </span>
  );
}

export function LoadingBar() {
  return (
    <span aria-hidden="true" className="sf-loading-bar">
      <i />
    </span>
  );
}
