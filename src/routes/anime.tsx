import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/anime")({
  validateSearch: validateBrowseSearch,
  head: () => seo("Anime", "Classic and currently airing anime — TV, movies, OVAs and specials."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.anime}
      eyebrow={t.section.worlds}
      base={{ kind: "anime" }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={true}
    />
  );
}
