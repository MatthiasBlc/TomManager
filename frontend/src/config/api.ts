import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
  withCredentials: true,
});

export default api;
