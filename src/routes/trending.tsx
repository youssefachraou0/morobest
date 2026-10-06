import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/trending")({
  validateSearch: validateBrowseSearch,
  head: () => seo("Trending", "What everyone is watching right now on MOROBEST."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.trending}
      eyebrow={t.section.trending}
      base={{ kind: ["movie", "series", "anime"], sort: "popular" }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={false}
    />
  );
}
