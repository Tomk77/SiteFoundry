import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  unstyled = false,
  ...props
}: React.ComponentProps<"input"> & { unstyled?: boolean }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={
        unstyled
          ? className
          : cn(
              "h-[38px] w-full min-w-0 rounded-lg border-[1.5px] border-[var(--input)] bg-[var(--sf-surface)] px-2.5 py-2 text-[13px] text-[var(--sf-ink)] transition-[border-color,box-shadow,background-color] outline-none placeholder:text-[var(--sf-ink-3)] focus-visible:border-[var(--sf-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--sf-focus-ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--sf-sunken)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
              className,
            )
      }
      {...props}
    />
  );
}

export { Input };
