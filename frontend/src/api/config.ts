export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
export const API_V1 = `${API_BASE_URL}/V1`
