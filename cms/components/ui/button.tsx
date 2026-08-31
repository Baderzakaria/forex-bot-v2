import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[14px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--fx-ops-ink)] bg-[var(--fx-ops-ink)] text-[var(--fx-white)] shadow-[0_12px_24px_rgba(22,49,68,0.16)] hover:bg-[var(--fx-ops-slate)] hover:text-[var(--fx-white)]",
        outline:
          "border-[color:var(--fx-border-soft)] bg-[var(--fx-white)] text-[var(--fx-text-strong)] hover:border-[color:var(--fx-border-strong)] hover:bg-[var(--fx-sage)] aria-expanded:border-[color:var(--fx-border-strong)] aria-expanded:bg-[var(--fx-sage)] aria-expanded:text-[var(--fx-ops-ink)]",
        secondary:
          "border-[color:var(--fx-border-soft)] bg-[var(--fx-sage)] text-[var(--fx-ops-ink)] hover:bg-[color-mix(in_srgb,var(--fx-sage),white_10%)] aria-expanded:bg-[var(--fx-sage)] aria-expanded:text-[var(--fx-ops-ink)]",
        ghost:
          "text-[var(--fx-text-soft)] hover:bg-[rgba(22,49,68,0.05)] hover:text-[var(--fx-text-strong)] aria-expanded:bg-[rgba(22,49,68,0.05)] aria-expanded:text-[var(--fx-text-strong)]",
        destructive:
          "border-[color:var(--fx-danger)]/20 bg-[rgba(181,75,75,0.08)] text-[var(--fx-danger)] hover:bg-[rgba(181,75,75,0.14)] focus-visible:border-[color:var(--fx-danger)]/40 focus-visible:ring-[rgba(181,75,75,0.2)]",
        link: "text-[var(--fx-ops-ink)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[12px] px-2 text-xs in-data-[slot=button-group]:rounded-[12px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[14px] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-[14px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[12px] in-data-[slot=button-group]:rounded-[12px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[14px] in-data-[slot=button-group]:rounded-[14px]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
