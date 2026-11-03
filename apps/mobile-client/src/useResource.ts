import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./api";

export function useResource<T>(load: () => Promise<{ data?: T; error?: unknown }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await load();
    if (r.error !== undefined) setError(errorMessage(r.error));
    else setData(r.data ?? null);
    setLoading(false);
  }, deps);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, loading, error, refresh };
}
