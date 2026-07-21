import * as React from "react";

import { cn } from "@/lib/utils";

function NativeSelect({
  className,
  unstyled = false,
  ...props
}: React.ComponentProps<"select"> & { unstyled?: boolean }) {
  return (
    <select
      data-slot="native-select"
      className={
        unstyled
          ? className
          : cn(
              "h-[38px] w-full min-w-0 appearance-none rounded-lg border-[1.5px] border-field bg-surface px-2.5 pr-8 text-[13px] text-ink transition-[border-color,box-shadow,background-color] outline-none focus-visible:border-action focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-50",
              className,
            )
      }
      {...props}
    />
  );
}

export { NativeSelect };
