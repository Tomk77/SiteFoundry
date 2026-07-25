import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ScaffoldCmsToaster } from "../components/ui/sonner";
import { AuthProvider } from "../lib/auth";
import css from "../styles.css?url";

const themeScript = `(() => {
  try {
    const mode = localStorage.getItem('sc-interface-mode') || 'system';
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.scMode = mode;
    document.documentElement.dataset.scTheme = dark ? 'dark' : 'light';
  } catch (_) {}
})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Scaffold CMS" },
    ],
    links: [
      { rel: "stylesheet", href: css },
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
        <ScaffoldCmsToaster />
        <Scripts />
      </body>
    </html>
  );
}
