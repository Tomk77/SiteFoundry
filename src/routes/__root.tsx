import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth";
import css from "../styles.css?url";

const themeScript = `(() => {
  try {
    const mode = localStorage.getItem('sf-interface-mode') || 'system';
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.sfMode = mode;
    document.documentElement.dataset.sfTheme = dark ? 'dark' : 'light';
  } catch (_) {}
})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SiteFoundry" },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css",
      },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css",
      },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css",
      },
    ],
  }),
  shellComponent: Root,
});

function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
