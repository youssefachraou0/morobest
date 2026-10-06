import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const mbButton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        gold: "bg-gold-gradient text-primary-foreground shadow-glow hover:brightness-110",
        glass: "bg-foreground/10 text-foreground backdrop-blur-md border border-foreground/15 hover:bg-foreground/20",
        outline: "border border-gold/50 text-gold hover:bg-gold-soft",
        ghost: "text-foreground/80 hover:text-foreground hover:bg-foreground/5",
        subtle: "bg-surface-2 text-foreground hover:bg-accent",
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-md",
        md: "h-11 px-5 text-sm rounded-lg",
        lg: "h-12 px-7 text-base rounded-lg",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export type MbButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof mbButton>;

export const MbButton = forwardRef<HTMLButtonElement, MbButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(mbButton({ variant, size }), className)} {...props} />
));
MbButton.displayName = "MbButton";
