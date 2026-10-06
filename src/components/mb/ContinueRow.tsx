import { track } from "@/features/analytics/track";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/I18nProvider";
import { useProgress } from "@/features/library/useLibrary";
import { titlesQuery } from "@/features/catalog/queries";
import { LandscapeCard } from "./Cards";
import { Row } from "./Row";

export function ContinueRow() {
  const { t } = useI18n();
  const progress = useProgress();
  // 5%–90% watched counts as "in progress"; below 5% is noise, above 90% is completed.
  const rows = (progress.data ?? []).filter((r) => !r.completed && r.duration_s > 0 && r.position_s / r.duration_s >= 0.05 && r.position_s / r.duration_s < 0.9);
  const ids = Array.from(new Set(rows.map((r) => r.title_id))).slice(0, 20);
  const cards = useQuery({ ...titlesQuery({ ids, limit: 20 }), enabled: ids.length > 0 });
  if (!ids.length || !cards.data?.length) return null;
  return (
    <Row title={t.section.continue}>
      {ids.map((id) => {
        const c = cards.data!.find((x) => x.id === id);
        const p = rows.find((r) => r.title_id === id)!;
        return c ? <div key={id} className="contents" onClickCapture={() => track("continue_click", { titleId: id, episodeId: p.episode_id, ctx: "continue" })}><LandscapeCard key={id} title={c} progress={p.duration_s ? p.position_s / p.duration_s : 0} to={{ slug: c.slug, ep: p.episode_id }} /></div> : null;
      })}
    </Row>
  );
}
