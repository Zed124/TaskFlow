import { useEffect, useState, type RefObject } from "react";
import { useScrollContainer } from "@/app/scroll-container";

/** Rows rendered above and below the viewport, so fast scrolling never shows gaps. */
const OVERSCAN = 12;

export interface WindowRange {
  start: number;
  end: number;
  rowHeight: number;
}

function readRowHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--tf-row-h");
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) && px > 0 ? px : 36;
}

/**
 * Which slice of a fixed-height list is visible inside the app's scroll container. Lists keep
 * their full height (via padding), so the scrollbar and sticky headers behave normally.
 * `enabled: false` renders everything (small lists, tests).
 */
export function useWindowedRange(
  listRef: RefObject<HTMLElement | null>,
  count: number,
  enabled: boolean,
): WindowRange {
  const scroller = useScrollContainer();
  const [range, setRange] = useState<WindowRange>(() => ({
    start: 0,
    end: Math.min(count, 60),
    rowHeight: 36,
  }));

  useEffect(() => {
    if (!enabled || !scroller) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const list = listRef.current;
        if (!list) return;
        const rowHeight = readRowHeight();
        const listTop =
          list.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop;
        const viewTop = scroller.scrollTop - listTop;
        const start = Math.max(0, Math.floor(viewTop / rowHeight) - OVERSCAN);
        const end = Math.min(
          count,
          Math.ceil((viewTop + scroller.clientHeight) / rowHeight) + OVERSCAN,
        );
        setRange((r) =>
          r.start === start && r.end === end && r.rowHeight === rowHeight
            ? r
            : { start, end, rowHeight },
        );
      });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [scroller, listRef, count, enabled]);

  return enabled ? range : { start: 0, end: count, rowHeight: range.rowHeight };
}
