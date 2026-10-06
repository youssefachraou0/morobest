import { useRef, type ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Star8 } from "./Brand";

export function Row({ title, eyebrow, children, seeAll }: { title: string; eyebrow?: string; children: ReactNode; seeAll?: LinkProps }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t, dir } = useI18n();
  const scroll = (d: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: d * el.clientWidth * 0.85 * (dir === "rtl" ? -1 : 1), behavior: "smooth" });
  };
  return (
    <section className="group/row relative py-5">
      <div className="mb-3 flex items-end justify-between gap-4 px-4 sm:px-8 lg:px-14">
        <div>
          {eyebrow && <p className="eyebrow mb-1 flex items-center gap-2"><Star8 className="h-3 w-3" />{eyebrow}</p>}
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
        </div>
        {seeAll && (
          <Link {...seeAll} className="text-sm text-muted-foreground transition hover:text-gold">{t.action.seeAll}</Link>
        )}
      </div>
      <div className="relative">
        <button aria-label="Previous" onClick={() => scroll(-1)} className="absolute inset-y-0 start-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-background to-transparent opacity-0 transition group-hover/row:opacity-100 md:flex rtl:bg-gradient-to-l">
          <ChevronLeft className="h-7 w-7 rtl:rotate-180" />
        </button>
        <div ref={ref} className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:gap-4 sm:px-8 lg:px-14 [&>*]:snap-start">
          {children}
        </div>
        <button aria-label="Next" onClick={() => scroll(1)} className="absolute inset-y-0 end-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-background to-transparent opacity-0 transition group-hover/row:opacity-100 md:flex rtl:bg-gradient-to-r">
          <ChevronRight className="h-7 w-7 rtl:rotate-180" />
        </button>
      </div>
    </section>
  );
}
