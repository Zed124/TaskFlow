import { createContext, useContext } from "react";
import type { Services } from "./services";

export const ServicesContext = createContext<Services | null>(null);

/** Access the feature services created at boot (see services.ts). */
export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices must be used inside <ServicesProvider>");
  return services;
}
