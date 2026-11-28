import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-semibold tracking-[-0.01em] whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-card',
        brass:
          'bg-brass text-brass-foreground shadow-sm hover:bg-brass-hover hover:shadow-card',
        outline:
          'border-border bg-card/90 text-foreground shadow-2xs hover:border-primary/40 hover:bg-surface-subtle hover:text-foreground aria-expanded:border-primary/40 aria-expanded:bg-surface-subtle aria-expanded:text-foreground',
        secondary:
          'border-border/70 bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        ghost:
          'text-foreground/80 hover:bg-secondary/80 hover:text-foreground aria-expanded:bg-secondary/80 aria-expanded:text-foreground',
        destructive:
          'border-destructive/25 bg-destructive/10 text-destructive hover:border-destructive/50 hover:bg-destructive/15 focus-visible:border-destructive focus-visible:ring-destructive',
        link: 'font-semibold text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-12 min-w-12 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5',
        icon: 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
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
