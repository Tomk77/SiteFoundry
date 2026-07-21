"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-transparent bg-field transition-[background-color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-[3px] focus-visible:ring-focus-ring data-checked:bg-action data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:[&_[data-slot=switch-thumb]]:translate-x-4",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none ml-[2px] block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0_/_22%)] transition-transform"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
