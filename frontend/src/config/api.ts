import toast from "react-hot-toast";

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? "";

// Forme d'erreur compatible avec l'usage existant : err.response?.data?.error?.message
class ApiError extends Error {
  response: { status: number; data: unknown };

  constructor(status: number, data: unknown) {
    super(`HTTP ${status}`);
    this.response = { status, data };
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<{ data: T }> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new ApiError(res.status, data);

    // 401 : session expiree — redirect login (sauf sur les routes auth qui gerent le cas elles-memes)
    if (res.status === 401 && !url.includes("/api/auth/")) {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // 403 : acces refuse
    if (res.status === 403) {
      toast.error("Accès refusé");
    }

    return Promise.reject(error);
  }

  return { data: data as T };
}

const api = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: <T = any>(url: string) => request<T>("GET", url),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T = any>(url: string, body?: unknown) => request<T>("POST", url, body),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: <T = any>(url: string, body?: unknown) => request<T>("PUT", url, body),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: <T = any>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: <T = any>(url: string) => request<T>("DELETE", url),
};

export default api;
