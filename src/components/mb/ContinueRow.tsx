import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/I18nProvider";
import { useProgress } from "@/features/library/useLibrary";
import { titlesQuery } from "@/features/catalog/queries";
import { LandscapeCard } from "./Cards";
import { Row } from "./Row";

export function ContinueRow() {
  const { t } = useI18n();
  const progress = useProgress();
  const rows = (progress.data ?? []).filter((r) => !r.completed);
  const ids = Array.from(new Set(rows.map((r) => r.title_id))).slice(0, 20);
  const cards = useQuery({ ...titlesQuery({ ids, limit: 20 }), enabled: ids.length > 0 });
  if (!ids.length || !cards.data?.length) return null;
  return (
    <Row title={t.section.continue}>
      {ids.map((id) => {
        const c = cards.data!.find((x) => x.id === id);
        const p = rows.find((r) => r.title_id === id)!;
        return c ? <LandscapeCard key={id} title={c} progress={p.duration_s ? p.position_s / p.duration_s : 0} /> : null;
      })}
    </Row>
  );
}
