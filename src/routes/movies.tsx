import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/movies")({
  validateSearch: validateBrowseSearch,
  head: () => seo("Movies", "International and Arabic films — drama, thriller, sci-fi, romance and more."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.movies}
      eyebrow={t.section.worlds}
      base={{ kind: "movie" }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={false}
    />
  );
}
