import { createFileRoute } from '@tanstack/react-router'
import { Blocks, Braces, FileText, GitBranch, Globe2, PanelTop } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const foundations = [
    {
      icon: Globe2,
      title: 'Website-native',
      text: 'Pages, URLs, navigation, redirects, SEO, and preview are first-class concepts.',
    },
    {
      icon: Blocks,
      title: 'Structured composition',
      text: 'Typed content blocks give editors freedom while protecting the website design system.',
    },
    {
      icon: Braces,
      title: 'Framework-neutral core',
      text: 'The content model and API must not require consuming websites to use React or TanStack.',
    },
  ]

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide text-slate-100">
            <span className="grid size-9 place-items-center rounded-lg bg-cyan-300 text-slate-950">
              <PanelTop size={19} strokeWidth={2.2} />
            </span>
            SiteFoundry
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            Planning workspace
          </span>
        </header>

        <section className="grid gap-12 py-20 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:py-28">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Open-source · Website-first
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              A CMS built around how websites actually work.
            </h1>
          </div>
          <p className="max-w-xl text-lg leading-8 text-slate-400">
            This is the foundation for product research, architecture decisions, and a focused first release—not a finished CMS yet.
          </p>
        </section>

        <section className="grid gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 md:grid-cols-3">
          {foundations.map(({ icon: Icon, title, text }) => (
            <article className="bg-slate-950 p-7" key={title}>
              <Icon className="mb-8 text-cyan-300" size={24} />
              <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
              <p className="leading-7 text-slate-400">{text}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 py-14 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-7">
            <FileText className="mb-5 text-slate-400" size={22} />
            <h2 className="text-xl font-semibold text-white">Start with the product</h2>
            <p className="mt-3 leading-7 text-slate-400">
              The initial vision, scope, competitor notes, and open questions live in <code>docs/product</code>.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-7">
            <GitBranch className="mb-5 text-slate-400" size={22} />
            <h2 className="text-xl font-semibold text-white">Record the reasoning</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Architectural choices are captured as decision records in <code>docs/decisions</code>.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
