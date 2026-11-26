import { createContext, useContext } from "react";

/** The main content's scroll element (set by the app shell), for windowed lists. */
export const ScrollContainerContext = createContext<HTMLElement | null>(null);

export function useScrollContainer(): HTMLElement | null {
  return useContext(ScrollContainerContext);
}
