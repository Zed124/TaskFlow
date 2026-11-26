import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Command, Keyboard, LineChart, ShieldCheck, type LucideIcon } from "lucide-react";
import { createElement } from "react";
import { useInvalidateData, useServiceQuery } from "@/app/data";
import { useServices } from "@/app/use-services";
import { toast } from "@/app/toast-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/errors";
import { useSetting } from "@/features/settings/use-settings";

const STEPS: {
  icon: LucideIcon;
  title: "step1Title" | "step2Title" | "step3Title" | "step4Title";
  body: "step1" | "step2" | "step3" | "step4";
}[] = [
  { icon: Keyboard, title: "step1Title", body: "step1" },
  { icon: Command, title: "step2Title", body: "step2" },
  { icon: LineChart, title: "step3Title", body: "step3" },
  { icon: ShieldCheck, title: "step4Title", body: "step4" },
];

/** First-launch welcome. Shown until dismissed once; optional example data for exploring. */
export function OnboardingDialog() {
  const [completed, setCompleted] = useSetting("onboarding.completed");
  if (completed) return null;
  return <Welcome onDone={() => setCompleted(true)} />;
}

function Welcome({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const services = useServices();
  const invalidate = useInvalidateData();
  const { data: existing } = useServiceQuery(["tasks", "onboarding-count"], (s) =>
    s.tasks.list({ limit: 1, includeArchived: true }),
  );
  const hasTasks = (existing?.length ?? 0) > 0;
  const [samples, setSamples] = useState<boolean | null>(null);
  const addSamples = samples ?? !hasTasks;
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      if (addSamples) {
        const project = await services.projects.create({
          name: t("onboarding.sampleProject"),
          color: "violet",
        });
        const today = new Date();
        const iso = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const titles = (["t1", "t2", "t3", "t4"] as const).map((k) =>
          t(`onboarding.sampleTasks.${k}`),
        );
        for (const [i, title] of titles.entries()) {
          await services.tasks.create({
            title,
            projectId: project.id,
            priority: i === 0 ? "high" : "medium",
            dueDate: i < 2 ? iso(today) : null,
          });
        }
        await invalidate();
      }
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onDone()}
      title={t("onboarding.title")}
      description={t("onboarding.intro")}
      className="w-[min(620px,calc(100vw-32px))]"
      footer={
        <>
          <label
            className="me-auto flex items-center gap-2 text-xs text-fg-muted"
            title={t("onboarding.samplesHint")}
          >
            <Switch
              checked={addSamples}
              onCheckedChange={setSamples}
              aria-label={t("onboarding.samples")}
            />
            {t("onboarding.samples")}
          </label>
          <Button variant="primary" loading={busy} onClick={() => void start()}>
            {t("onboarding.start")}
          </Button>
        </>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.title} className="rounded-md border border-line bg-canvas p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-fg">
              {createElement(s.icon, {
                className: "size-4 text-accent-text",
                strokeWidth: 1.75,
                "aria-hidden": true,
              })}
              {t(`onboarding.${s.title}`)}
            </div>
            <p className="text-xs text-fg-muted">{t(`onboarding.${s.body}`)}</p>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
