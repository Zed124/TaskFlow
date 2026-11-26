import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { DatabaseZap } from "lucide-react";
import { openDatabase } from "@/db/client";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { settingsQueryKey } from "@/features/settings/use-settings";
import { applyAppearance } from "@/features/settings/appearance";
import { createServices, type Services } from "./services";
import { ServicesProvider } from "./services-context";

type BootState =
  | { status: "opening" }
  | { status: "failed"; message: string; detail?: string }
  | { status: "ready"; services: Services };

const queryClient = new QueryClient({
  defaultOptions: {
    // Local DB: data only changes through our own mutations, so no background refetching.
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
    mutations: { retry: false },
  },
});

/** Opens + migrates the database and preloads settings. Never throws; failures become a state. */
async function bootstrap(t: TFunction): Promise<BootState> {
  if (!isTauri()) return { status: "failed", message: t("boot.notInDesktop") };
  try {
    const { db } = await openDatabase();
    const services = createServices(db);
    const settings = await queryClient.query({
      queryKey: settingsQueryKey,
      queryFn: () => services.settings.getAll(),
    });
    applyAppearance(settings["ui.accent"], settings["ui.density"]);
    return { status: "ready", services };
  } catch (error) {
    const detail =
      error instanceof Error && error.cause !== undefined ? errorMessage(error.cause) : undefined;
    return { status: "failed", message: errorMessage(error), ...(detail ? { detail } : {}) };
  }
}

/** Renders children only once the database is open, migrated and settings are loaded. */
export function BootGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<BootState>({ status: "opening" });

  useEffect(() => {
    let cancelled = false;
    void bootstrap(t).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const retry = () => {
    setState({ status: "opening" });
    void bootstrap(t).then(setState);
  };

  if (state.status === "opening") {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-fg-muted">
        <Spinner />
        {t("boot.opening")}
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <EmptyState
        className="h-full"
        icon={DatabaseZap}
        title={t("boot.failedTitle")}
        description={
          <>
            {t("boot.failedHint")}
            <code className="selectable mt-3 block rounded-sm border border-line bg-surface px-3 py-2 text-start font-mono text-xs whitespace-pre-wrap text-fg-muted">
              {state.detail ? `${state.message}\n${state.detail}` : state.message}
            </code>
          </>
        }
        action={
          <Button variant="primary" onClick={retry}>
            {t("boot.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={state.services}>{children}</ServicesProvider>
    </QueryClientProvider>
  );
}
