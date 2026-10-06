import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/manga")({
  validateSearch: validateBrowseSearch,
  head: () => seo("Manga, Manhwa & Manhua", "Discover manga, manhwa and manhua with volumes and chapter listings."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.manga}
      eyebrow={t.section.worlds}
      base={{ kind: "manga" }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={true}
    />
  );
}
