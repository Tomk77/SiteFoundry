import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  unstyled = false,
  ...props
}: React.ComponentProps<"textarea"> & { unstyled?: boolean }) {
  return (
    <textarea
      data-slot="textarea"
      className={
        unstyled
          ? className
          : cn(
              "flex min-h-16 w-full resize-y rounded-lg border-[1.5px] border-[var(--input)] bg-[var(--sf-surface)] px-2.5 py-2 text-[13px] leading-6 text-[var(--sf-ink)] transition-[border-color,box-shadow,background-color] outline-none placeholder:text-[var(--sf-ink-3)] focus-visible:border-[var(--sf-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--sf-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--sf-sunken)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
              className
            )
      }
      {...props}
    />
  )
}

export { Textarea }
