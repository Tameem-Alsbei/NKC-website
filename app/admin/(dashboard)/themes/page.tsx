import type { Metadata } from "next";
import { InlineActionButton } from "@/components/admin/inline-action-button";
import { PageHeader } from "@/components/admin/layout-parts";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { canManageSensitiveRecords } from "@/lib/auth/access";
import { requireAdmin } from "@/lib/auth/admin";
import { themeSettings } from "@/lib/config/program";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveTheme, setActiveTheme } from "./actions";
import { ThemeForm } from "./theme-form";

export const metadata: Metadata = { title: "Themes" };

export default async function ThemesPage() {
  const admin = await requireAdmin();
  const canEdit = canManageSensitiveRecords(admin);
  const supabase = await createSupabaseServerClient();
  const { data: themes, error } = await supabase
    .from("program_themes")
    .select("id, cycle_position, name, main_value, description, color_hex, is_active, starts_on, ends_on")
    .order("cycle_position");
  if (error) throw new Error("Could not load themes");

  const active = themes.find((theme) => theme.is_active);

  return (
    <>
      <PageHeader
        title="Rotating themes"
        description={`Noor Kids Club rotates through ${themeSettings.cycleLength} yearly themes. The active theme appears on the homepage once it has a name and main value.`}
        actions={
          canEdit && active ? (
            <InlineActionButton action={setActiveTheme.bind(null, null)} label="Hide theme from homepage" pendingLabel="Saving…" tone="danger" confirmMessage="Hide the theme section from the homepage?" />
          ) : undefined
        }
      />

      {!canEdit && (
        <Alert tone="info" className="mb-6">
          Only full administrators can edit themes.
        </Alert>
      )}
      <Alert tone={active ? "success" : "info"} className="mb-6">
        {active
          ? `"${active.name}" (year ${active.cycle_position} of ${themeSettings.cycleLength}) is the active theme.`
          : "No theme is active, so the homepage theme section is hidden."}
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {themes.map((theme) => {
          const ready = Boolean(theme.name && theme.main_value);
          return (
            <Card key={theme.id} className={theme.is_active ? "ring-2 ring-sun-500" : undefined}>
              <CardHeader
                title={`Year ${theme.cycle_position}${theme.name ? `: ${theme.name}` : ""}`}
                description={theme.is_active ? "Active theme" : ready ? "Ready to use" : "Not filled in yet"}
                action={
                  canEdit && ready && !theme.is_active ? (
                    <InlineActionButton action={setActiveTheme.bind(null, theme.id)} label="Make active" pendingLabel="Saving…" />
                  ) : undefined
                }
              />
              <div className="px-5 py-5 sm:px-6">
                <ThemeForm action={saveTheme.bind(null, theme.id)} theme={theme} readOnly={!canEdit} />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
