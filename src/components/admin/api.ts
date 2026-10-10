export interface ApiResult<T = Record<string, unknown>> { ok: boolean; status: number; data: T; error?: string }

/** fetch JSON contra /api/admin/*: devuelve siempre un resultado, nunca lanza. */
export async function adminFetch<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 401 && !url.endsWith("/login")) window.location.assign("/admin/login");
    return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : data.error ?? "No se pudo completar la acción." };
  } catch {
    return { ok: false, status: 0, data: {} as T, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}
