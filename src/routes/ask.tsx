import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { recommendTitles } from "@/features/recommend/recommend.functions";
import { TmdbPoster } from "@/components/mb/Tmdb";
import { AniPoster } from "@/components/mb/Ani";
import { PosterSkeleton } from "@/components/mb/Cards";
import { mbButton } from "@/components/mb/Button";
import { seo } from "@/lib/seo";

const COPY = {
  en: { eyebrow: "AI-powered", title: "What do you feel like watching?", sub: "Describe a mood, a plot, or a favourite — we'll find movies, series and anime to match.", ph: "e.g. a slow-burn Korean thriller with a twist ending, or a cosy anime about cooking", go: "Recommend", busy: "Finding titles…", ex: ["Feel-good movie for a family night", "Dark crime series like Breaking Bad", "Short anime with great fights"] },
  fr: { eyebrow: "Propulsé par l'IA", title: "Qu'avez-vous envie de regarder ?", sub: "Décrivez une ambiance, une intrigue ou un favori — nous trouvons films, séries et animés.", ph: "ex. un thriller coréen avec une fin surprenante", go: "Recommander", busy: "Recherche…", ex: ["Film feel-good en famille", "Série criminelle sombre comme Breaking Bad", "Anime court avec de super combats"] },
  ar: { eyebrow: "بالذكاء الاصطناعي", title: "ماذا تريد أن تشاهد؟", sub: "صف مزاجك أو قصة أو عملاً تحبه — وسنقترح أفلاماً ومسلسلات وأنمي مناسبة.", ph: "مثلاً: مسلسل تشويق كوري بنهاية غير متوقعة", go: "اقترح", busy: "جارٍ البحث…", ex: ["فيلم مبهج لسهرة عائلية", "مسلسل جريمة مظلم مثل Breaking Bad", "أنمي قصير بمعارك رائعة"] },
} as const;

export const Route = createFileRoute("/ask")({
  head: () => seo("Ask MOROBEST — AI recommendations", "Describe what you want to watch and get AI-powered movie, series and anime recommendations from MOROBEST."),
  component: AskPage,
});

function AskPage() {
  const { locale } = useI18n();
  const { maxAge } = useAuth();
  const c = COPY[locale];
  const [text, setText] = useState("");
  const fn = useServerFn(recommendTitles);
  const m = useMutation({ mutationFn: (prompt: string) => fn({ data: { prompt, locale, family: maxAge != null && maxAge < 13 } }) });
  const submit = (p = text) => { const v = p.trim(); if (v.length >= 3 && !m.isPending) { setText(v); m.mutate(v); } };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles className="h-4 w-4" />{c.eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">{c.title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{c.sub}</p>
      <form className="mt-6 flex flex-col gap-3 md:flex-row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder={c.ph} aria-label={c.title}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" disabled={m.isPending || text.trim().length < 3} className={mbButton({ size: "lg" })}>{m.isPending ? c.busy : c.go}</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {c.ex.map((e) => <button key={e} type="button" onClick={() => submit(e)} className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground">{e}</button>)}
      </div>

      {m.isPending && <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <PosterSkeleton key={i} />)}</div>}
      {m.isError && <p className="mt-8 text-destructive">The recommender is unavailable right now.</p>}
      {m.data?.error && <p className="mt-8 text-muted-foreground">{m.data.error}</p>}
      {m.data && m.data.items.length > 0 && !m.isPending && (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-5">
          {m.data.items.map((r) => (
            <div key={r.source === "tmdb" ? `t${r.item.type}${r.item.tmdbId}` : `a${r.item.aniListId}`}>
              {r.source === "tmdb" ? <TmdbPoster item={r.item} ctx="ai_recommend" /> : <AniPoster item={r.item} ctx="ai_recommend" />}
              <p className="mt-2 text-xs leading-snug text-muted-foreground">{r.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
