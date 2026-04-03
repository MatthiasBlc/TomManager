import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl: string = error.config?.url ?? "";

    // 401 : session expiree — redirect login (sauf sur les routes auth qui gerent le cas elles-memes)
    if (status === 401 && !requestUrl.includes("/api/auth/")) {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // 403 : acces refuse
    if (status === 403) {
      toast.error("Acces refuse");
    }

    return Promise.reject(error);
  }
);

export default api;
