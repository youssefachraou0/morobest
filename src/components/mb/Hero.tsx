import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info, Play, Star } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { tr, ageLabel } from "@/features/catalog/localize";
import type { TitleCard } from "@/features/catalog/types";
import { mbButton } from "./Button";
import { Badge } from "./Cards";
import { cn } from "@/lib/utils";

export function Hero({ items }: { items: TitleCard[] }) {
  const { t, locale } = useI18n();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % items.length), 8000);
    return () => clearInterval(id);
  }, [items.length]);
  const cur = items[i];
  if (!cur) return <div className="h-[60vh]" />;
  const l = tr(cur, locale);

  return (
    <section className="relative h-[82vh] min-h-[560px] w-full overflow-hidden" aria-roledescription="carousel">
      {items.map((it, idx) => (
        <img
          key={it.id}
          src={it.backdrop!}
          alt=""
          aria-hidden={idx !== i}
          fetchPriority={idx === 0 ? "high" : "low"}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms]", idx === i ? "opacity-100 animate-slow-zoom" : "opacity-0")}
        />
      ))}
      <div className="absolute inset-0 bg-hero-side" />
      <div className="absolute inset-0 bg-hero-fade" />
      <div className="absolute inset-0 pattern-zellige opacity-[0.035]" aria-hidden />

      <div key={cur.id} className="relative flex h-full max-w-3xl flex-col justify-end px-4 pb-24 sm:px-8 lg:px-14">
        <p className="eyebrow animate-fade-up">{t.hero.tagline}</p>
        <h1 className="mt-3 animate-fade-up font-display text-5xl font-semibold leading-[0.95] sm:text-7xl" style={{ animationDelay: "80ms" }}>
          {l.title}
        </h1>
        <div className="mt-4 flex animate-fade-up flex-wrap items-center gap-3 text-sm text-foreground/80" style={{ animationDelay: "160ms" }}>
          {cur.rating && <span className="inline-flex items-center gap-1 text-gold"><Star className="h-4 w-4 fill-current" />{cur.rating.toFixed(1)}</span>}
          {cur.year && <span>{cur.year}</span>}
          <Badge>{ageLabel(cur.ageRating)}</Badge>
          {cur.runtime && cur.kind === "movie" && <span>{cur.runtime} {t.label.min}</span>}
        </div>
        {l.synopsis && <p className="mt-4 max-w-xl animate-fade-up text-base text-foreground/80 sm:text-lg" style={{ animationDelay: "220ms" }}>{l.synopsis}</p>}
        <div className="mt-7 flex animate-fade-up gap-3" style={{ animationDelay: "280ms" }}>
          <Link to="/watch/$slug" params={{ slug: cur.slug }} className={mbButton({ size: "lg" })}><Play className="fill-current" />{t.action.play}</Link>
          <Link {...canonical({ kind: "title", slug: cur.slug })} className={mbButton({ variant: "glass", size: "lg" })}><Info />{t.action.moreInfo}</Link>
        </div>
        <div className="mt-10 flex gap-2" role="tablist">
          {items.map((it, idx) => (
            <button
              key={it.id}
              role="tab"
              aria-selected={idx === i}
              aria-label={tr(it, locale).title}
              onClick={() => setI(idx)}
              className={cn("h-1 rounded-full transition-all duration-500", idx === i ? "w-10 bg-gold" : "w-4 bg-foreground/30 hover:bg-foreground/60")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
