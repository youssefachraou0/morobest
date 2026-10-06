import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/new")({
  validateSearch: validateBrowseSearch,
  head: () => seo("New Releases", "The newest movies, series and anime on MOROBEST."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.new}
      eyebrow={t.section.new}
      base={{ kind: ["movie", "series", "anime"], sort: "newest" }}
      search={{ sort: undefined, ...search }}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={false}
    />
  );
}
