import { useCallback, useEffect, useRef, useState } from "react";
export async function api<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(!options.body || options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
  return data as T;
}
export const post = <T = Record<string, unknown>>(
  url: string,
  body: unknown = {},
) => api<T>(url, { method: "POST", body: JSON.stringify(body) });
export function useLoad<T>(url: string | null, interval = 0) {
  const generation = useRef(0);
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const result = await api<T>(url);
      if (request !== generation.current) return;
      setData(result);
      setError("");
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setLoading(true);
    setData(null);
    void refresh();
    const timer = interval
      ? setInterval(() => void refresh(), interval)
      : undefined;
    return () => {
      generation.current++;
      if (timer) clearInterval(timer);
    };
  }, [refresh, interval]);
  return { data, error, loading, refresh };
}
