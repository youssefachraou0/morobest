import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Star8 } from "./Brand";
import { mbButton } from "./Button";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center overflow-hidden rounded-2xl border border-border px-8 py-14 text-center">
      <div className="absolute inset-0 pattern-zellige opacity-[0.07]" aria-hidden />
      <Star8 className="relative h-12 w-12 text-gold/80" />
      <h3 className="relative mt-5 font-display text-2xl">{title}</h3>
      {body && <p className="relative mt-2 text-sm text-muted-foreground">{body}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

export function FullPageMessage({ code, title, body, homeLabel = "Home" }: { code?: string; title: string; body?: string; homeLabel?: string }) {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center px-6">
      <div className="absolute inset-0 pattern-zellige opacity-[0.05]" aria-hidden />
      <div className="relative text-center">
        {code && <p className="font-display text-8xl font-bold text-gold-gradient">{code}</p>}
        <h1 className="mt-4 font-display text-3xl">{title}</h1>
        {body && <p className="mt-2 text-muted-foreground">{body}</p>}
        <Link to="/" className={mbButton({ variant: "outline", className: "mt-8" })}>{homeLabel}</Link>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden px-4 pb-6 pt-28 sm:px-8 lg:px-14">
      <div className="absolute inset-0 bg-emerald-glow" aria-hidden />
      <div className="absolute inset-0 pattern-zellige opacity-[0.04]" aria-hidden />
      <div className="relative animate-fade-up">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold sm:text-6xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
    </header>
  );
}
