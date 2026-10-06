import logo from "@/assets/morobest-logo.png";
import { cn } from "@/lib/utils";

export function StarMark({ className }: { className?: string }) {
  return <img src={logo} alt="" aria-hidden width={1024} height={1024} className={cn("object-contain", className)} />;
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} dir="ltr">
      <StarMark className="h-8 w-8" />
      {!compact && <span className="font-display text-2xl font-semibold tracking-[0.18em] text-gold-gradient">MOROBEST</span>}
    </span>
  );
}

/** Eight-point star, drawn as SVG so it can be animated and colored by tokens. */
export function Star8({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="6" y="6" width="12" height="12" />
      <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
    </svg>
  );
}

export function StarDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-gold/70", className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
      <Star8 className="h-3.5 w-3.5" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  );
}

export function StarLoader({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex items-center justify-center py-16 text-gold", className)}>
      <Star8 className="h-10 w-10 animate-star" />
    </div>
  );
}
