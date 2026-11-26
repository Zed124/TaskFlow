import type { ReactNode } from "react";
import type { Services } from "./services";
import { ServicesContext } from "./use-services";

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
