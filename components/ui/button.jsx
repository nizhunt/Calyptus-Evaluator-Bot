import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "w-full max-w-[170px] md:max-w-none rounded-xl border border-solid border-calyptus-accent-periwinkle bg-white px-4 py-2 font-bold text-sm leading-snug text-calyptus-strong shadow-none hover:bg-gray-50 hover:text-calyptus-strong",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        text: "text-primary hover:text-black !p-0",
        primary:
          "rounded-xl border-transparent bg-calyptus-blue-deep text-lg font-bold text-white shadow-none transition-colors duration-200 ease-out hover:bg-[#0a2789] disabled:cursor-not-allowed disabled:!bg-gray-400 disabled:opacity-100 disabled:hover:!bg-gray-400",
        destructiveSolid:
          "rounded-lg border border-red-600 bg-red-600 text-white shadow-none hover:bg-red-700 focus-visible:border-red-600 focus-visible:ring-red-600/25",
        restartTour:
          "order-2 md:order-1 md:w-[170px] justify-start py-1 px-2 -ml-2 border-transparent bg-transparent text-left text-base font-semibold leading-snug text-calyptus-nav shadow-none hover:bg-gray-100/80 hover:text-calyptus-nav-hover",
        modalDismiss:
          "border-transparent bg-calyptus-muted text-white shadow-none transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        modalPrimary:
          "border-transparent bg-calyptus-blue-deep text-white shadow-none transition-opacity hover:bg-[#0a2789] disabled:cursor-not-allowed disabled:!bg-gray-400 disabled:opacity-100 disabled:hover:!bg-gray-400",
        modalPrimaryQuiet:
          "border-transparent bg-calyptus-blue-deep text-white shadow-none transition-opacity hover:bg-[#0a2789]",
      },
      size: {
        header:
          "h-auto min-h-0 gap-2.5 px-0 py-0 has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0",
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 w-max py-2 gap-1.5 px-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        submit:
          "h-auto min-h-11 w-full gap-2 px-6 py-3 text-base font-semibold has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6",
        recorder:
          "h-auto min-h-10 w-full gap-2 px-4 py-2 text-sm font-medium sm:w-max has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        modal:
          "h-auto min-h-0 w-max max-w-full gap-0 rounded-xl px-4 py-2 text-sm font-bold has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
