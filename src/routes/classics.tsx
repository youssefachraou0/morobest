import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/mb/BrowsePage";
import { useI18n } from "@/i18n/I18nProvider";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/classics")({
  validateSearch: validateBrowseSearch,
  head: () => seo("Classics", "Restored heritage cinema from Morocco, the Arab world and beyond."),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BrowsePage
      title={t.nav.classics}
      eyebrow={t.section.worlds}
      base={{ classic: true }}
      search={search}
      onSearch={(s) => navigate({ search: s, replace: true })}
      showStatus={false}
    />
  );
}
