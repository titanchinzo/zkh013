import { useEffect, useRef } from "react";

/**
 * fn-ийг ms тутамд дуудна — зөвхөн хуудас харагдаж байхад (утсаа түгжсэн, өөр апп нээсэн үед зогсоно);
 * хуудас руу буцаж ороход шууд дуудна. enabled: false бол огт дуудахгүй.
 */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const id = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms, enabled]);
}
