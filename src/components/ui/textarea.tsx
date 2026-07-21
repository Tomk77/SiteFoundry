import * as React from "react";

import { cn } from "@/lib/utils";

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
              "flex min-h-16 w-full resize-y rounded-lg border-[1.5px] border-field bg-surface px-2.5 py-2 text-[13px] leading-6 text-ink transition-[border-color,box-shadow,background-color] outline-none placeholder:text-ink-subtle focus-visible:border-action focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/20",
              className,
            )
      }
      {...props}
    />
  );
}

export { Textarea };
