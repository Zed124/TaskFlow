import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing } from "lucide-react";
import { toast } from "@/app/toast-store";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { REMINDER_LEADS, type ReminderLead } from "@/domain/settings";
import { errorMessage } from "@/lib/errors";
import { autostart, notifications } from "@/platform/desktop";
import { Row, Section } from "./settings-rows";
import { useSetting } from "./use-settings";

/** Windows behavior and notification preferences. */
export function DesktopSettings() {
  const { t } = useTranslation();
  const [closeToTray, setCloseToTray] = useSetting("system.closeToTray");
  const [enabled, setEnabled] = useSetting("notifications.enabled");
  const [reminders, setReminders] = useSetting("notifications.reminders");
  const [lead, setLead] = useSetting("notifications.reminderLeadMinutes");
  const [digest, setDigest] = useSetting("notifications.dailyDigest");
  const [digestTime, setDigestTime] = useSetting("notifications.digestTime");
  const [overdue, setOverdue] = useSetting("notifications.overdue");

  // "Start with Windows" lives in the registry; read it rather than mirroring it in settings.
  const [startup, setStartup] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    autostart
      .isEnabled()
      .then((on) => alive && setStartup(on))
      .catch(() => alive && setStartup(false));
    return () => {
      alive = false;
    };
  }, []);

  const toggleStartup = async (on: boolean) => {
    try {
      await autostart.set(on);
      setStartup(await autostart.isEnabled());
    } catch (error) {
      toast.error(t("settings.windows.startupFailed", { message: errorMessage(error) }));
    }
  };

  const sendTest = async () => {
    const ok = await notifications.send(
      t("settings.notifications.testTitle"),
      t("settings.notifications.testBody"),
    );
    if (!ok) toast.error(t("settings.notifications.blocked"));
  };

  return (
    <>
      <Section title={t("settings.windows.title")}>
        <Row
          label={t("settings.windows.closeToTray")}
          hint={t("settings.windows.closeToTrayHint")}
          htmlFor="close-to-tray"
        >
          <Switch id="close-to-tray" checked={closeToTray} onCheckedChange={setCloseToTray} />
        </Row>
        <Row
          label={t("settings.windows.startup")}
          hint={t("settings.windows.startupHint")}
          htmlFor="startup"
        >
          <Switch
            id="startup"
            checked={startup ?? false}
            disabled={startup === null}
            onCheckedChange={(on) => void toggleStartup(on)}
          />
        </Row>
      </Section>

      <Section title={t("settings.notifications.title")}>
        <Row
          label={t("settings.notifications.enabled")}
          hint={t("settings.notifications.enabledHint")}
          htmlFor="notify"
        >
          <Switch id="notify" checked={enabled} onCheckedChange={setEnabled} />
        </Row>
        <Row
          label={t("settings.notifications.reminders")}
          hint={t("settings.notifications.remindersHint")}
          htmlFor="notify-reminders"
        >
          <div className="flex items-center gap-2">
            <Select
              aria-label={t("settings.notifications.lead")}
              value={String(lead)}
              disabled={!enabled || !reminders}
              onValueChange={(v) => setLead(Number(v) as ReminderLead)}
              className="h-7 w-36 text-xs"
              options={REMINDER_LEADS.map((m) => ({
                value: String(m),
                label:
                  m === 0
                    ? t("settings.notifications.atDueTime")
                    : t("settings.notifications.minutesBefore", { count: m }),
              }))}
            />
            <Switch
              id="notify-reminders"
              checked={reminders}
              disabled={!enabled}
              onCheckedChange={setReminders}
            />
          </div>
        </Row>
        <Row
          label={t("settings.notifications.overdue")}
          hint={t("settings.notifications.overdueHint")}
          htmlFor="notify-overdue"
        >
          <Switch
            id="notify-overdue"
            checked={overdue}
            disabled={!enabled}
            onCheckedChange={setOverdue}
          />
        </Row>
        <Row
          label={t("settings.notifications.digest")}
          hint={t("settings.notifications.digestHint")}
          htmlFor="notify-digest"
        >
          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label={t("settings.notifications.digestTime")}
              value={digestTime}
              disabled={!enabled || !digest}
              onChange={(e) => e.target.value && setDigestTime(e.target.value)}
              className="h-7 rounded-sm border border-line bg-canvas px-2 text-xs text-fg disabled:opacity-50"
            />
            <Switch
              id="notify-digest"
              checked={digest}
              disabled={!enabled}
              onCheckedChange={setDigest}
            />
          </div>
        </Row>
        <Row label={t("settings.notifications.test")} hint={t("settings.notifications.testHint")}>
          <Button size="sm" variant="secondary" onClick={() => void sendTest()}>
            <BellRing className="size-3.5" aria-hidden />
            {t("settings.notifications.sendTest")}
          </Button>
        </Row>
      </Section>
    </>
  );
}
