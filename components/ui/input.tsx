import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-xl border border-input bg-card px-4 py-2 text-base shadow-2xs transition-[color,background-color,border-color,box-shadow] duration-150 outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-primary/45 focus-visible:border-primary focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
