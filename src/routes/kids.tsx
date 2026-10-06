import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/kids")({
  validateSearch: validateBrowseSearch,
  head: () => seo("Kids & Family", "Safe, age-appropriate cartoons, animated films and family series."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.kids}
      eyebrow={t.section.kids}
      base={{ kids: true }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={false}
    />
  );
}
