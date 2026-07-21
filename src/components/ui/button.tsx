import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border text-[12.5px] font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] outline-none select-none focus-visible:border-action focus-visible:ring-[3px] focus-visible:ring-focus-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/20 [&_i]:pointer-events-none [&_i]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-action bg-action text-on-action shadow-[0_1px_2px_rgb(23_35_38_/_10%)] hover:border-action-hover hover:bg-action-hover",
        outline:
          "border-border bg-surface text-ink shadow-control hover:bg-sunken aria-expanded:bg-sunken",
        secondary:
          "border-transparent bg-sunken text-ink hover:bg-selection aria-expanded:bg-selection",
        ghost:
          "border-transparent bg-transparent text-ink-muted hover:bg-selection hover:text-ink aria-expanded:bg-selection",
        destructive:
          "border-danger bg-danger text-white hover:border-danger-hover hover:bg-danger-hover focus-visible:border-danger focus-visible:ring-danger/20",
        link: "border-transparent bg-transparent text-action underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5 text-[13px]",
        xs: "h-7 gap-1.5 rounded-md px-2 text-[11px]",
        sm: "h-8 gap-1.5 px-2.5 text-xs",
        lg: "h-10 gap-2 px-4 text-sm",
        icon: "size-9 p-0",
        "icon-xs": "size-7 rounded-md p-0 text-xs",
        "icon-sm": "size-8 p-0 text-sm",
        "icon-lg": "size-10 p-0 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  children,
  className,
  disabled,
  loading = false,
  variant = "default",
  size = "default",
  unstyled = false,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    unstyled?: boolean;
  }) {
  return (
    <ButtonPrimitive
      aria-busy={loading || undefined}
      data-slot="button"
      disabled={disabled || loading}
      className={unstyled ? className : cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="sf-button-spinner [display:inline-block] [height:15px] [width:15px] [flex:none] [animation:sf-loading-spin_0.8s_linear_infinite] [border-radius:999px] [border-width:2px] [border-style:solid] [border-color:color-mix(in_srgb,_currentColor_35%,_transparent)] [border-top-color:currentColor] motion-reduce:[animation:none]"
        />
      ) : null}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
