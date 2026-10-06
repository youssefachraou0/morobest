import { Link } from "@tanstack/react-router";
import { Play, Star } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { tr, ageLabel } from "@/features/catalog/localize";
import type { Episode, TitleCard } from "@/features/catalog/types";
import { cn } from "@/lib/utils";

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "gold" | "red" | "green"; className?: string }) {
  const tones = {
    default: "bg-background/70 text-foreground/90 border-foreground/15",
    gold: "bg-gold-soft text-gold border-gold/40",
    red: "bg-destructive/85 text-destructive-foreground border-transparent",
    green: "bg-emerald/80 text-foreground border-transparent",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PosterCard({ title, rank, className }: { title: TitleCard; rank?: number; className?: string }) {
  const { locale, t } = useI18n();
  const name = tr(title, locale).title;
  const canonical = useCanonical();
  return (
    <Link
      {...canonical({ kind: "title", slug: title.slug })}
      className={cn("group relative block shrink-0 focus-visible:outline-none", rank ? "w-[150px] ps-10 sm:w-[190px] sm:ps-14" : "w-[136px] sm:w-[168px] lg:w-[184px]", className)}
    >
      {rank && (
        <span aria-hidden className="pointer-events-none absolute bottom-0 start-0 font-display text-[7rem] font-bold leading-none text-transparent [-webkit-text-stroke:2px_var(--gold)] sm:text-[9rem]">
          {rank}
        </span>
      )}
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 shadow-poster ring-1 ring-foreground/10 transition-all duration-500 group-hover:-translate-y-1 group-hover:ring-gold/60 group-focus-visible:ring-2 group-focus-visible:ring-gold">
        {title.poster && (
          <img src={title.poster} alt={name} loading="lazy" width={768} height={1152} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-card-fade opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute start-2 top-2 flex gap-1">
          {title.status === "airing" && <Badge tone="red">{t.label.airing}</Badge>}
          {title.kind === "anime" && <Badge tone="gold">Anime</Badge>}
        </div>
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-center gap-2 text-[11px] text-foreground/80">
            {title.rating && (
              <span className="inline-flex items-center gap-0.5 text-gold"><Star className="h-3 w-3 fill-current" />{title.rating.toFixed(1)}</span>
            )}
            {title.year && <span>{title.year}</span>}
            <span className="rounded-sm border border-foreground/30 px-1">{ageLabel(title.ageRating)}</span>
          </div>
        </div>
      </div>
      {!rank && <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground/85 group-hover:text-gold">{name}</p>}
    </Link>
  );
}

export function LandscapeCard({ title, progress, className, subtitle, to }: { title: TitleCard; progress?: number; className?: string; subtitle?: string; to?: { slug: string; ep: string | null } }) {
  const { locale } = useI18n();
  const name = tr(title, locale).title;
  return (
    <Link {...(to ? { to: "/watch/$slug" as const, params: { slug: to.slug }, search: to.ep ? { ep: to.ep } : {} } : canonical({ kind: "title", slug: title.slug }))} className={cn("group relative block w-[260px] shrink-0 sm:w-[320px]", className)}>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2 ring-1 ring-foreground/10 transition group-hover:ring-gold/60">
        {(title.backdrop ?? title.poster) && (
          <img src={title.backdrop ?? title.poster!} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-card-fade" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground shadow-glow"><Play className="h-5 w-5 fill-current" /></span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-1 font-display text-lg font-semibold">{name}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {progress != null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20"><div className="h-full bg-gold" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
        )}
      </div>
    </Link>
  );
}

export function EpisodeCard({ ep, slug, active, progress }: { ep: Episode; slug: string; active?: boolean; progress?: number }) {
  const { t } = useI18n();
  return (
    <Link
      to="/watch/$slug"
      params={{ slug }}
      search={{ ep: ep.id }}
      className={cn("group flex gap-4 rounded-lg p-2 transition hover:bg-surface-2", active && "bg-surface-2 ring-1 ring-gold/40")}
    >
      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-md bg-surface-2 sm:w-44">
        {ep.thumbnail_url && <img src={ep.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"><Play className="h-7 w-7 fill-current text-foreground" /></span>
        {progress != null && <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20"><div className="h-full bg-gold" style={{ width: `${progress * 100}%` }} /></div>}
      </div>
      <div className="min-w-0 py-1">
        <p className="text-xs text-gold">{t.label.episode} {ep.number}{ep.runtime_min ? ` · ${ep.runtime_min} ${t.label.min}` : ""}</p>
        <p className="line-clamp-1 font-medium">{ep.title}</p>
        {ep.synopsis && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ep.synopsis}</p>}
      </div>
    </Link>
  );
}

export function PersonCard({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div className="flex w-28 shrink-0 flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald pattern-zellige font-display text-2xl text-gold ring-1 ring-gold/30">{initials}</div>
      <p className="mt-2 line-clamp-1 text-sm font-medium">{name}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{role}</p>
    </div>
  );
}

export function PosterSkeleton() {
  return <div className="aspect-[2/3] w-[136px] shrink-0 animate-pulse rounded-lg bg-surface-2 sm:w-[168px] lg:w-[184px]" />;
}
