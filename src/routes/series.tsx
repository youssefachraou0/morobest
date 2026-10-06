import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/series")({
  validateSearch: validateBrowseSearch,
  head: () => seo("TV Series", "Series and mini-series from around the world, with full seasons and episodes."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.series}
      eyebrow={t.section.worlds}
      base={{ kind: "series" }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={true}
    />
  );
}
