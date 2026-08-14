import axios from 'axios';

const BACKEND_FALLBACK = 'https://lotisec-backend.vercel.app';
const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
// FastAPI Cloud ne sert que l'assistant IA. Une variable Vercel mal renseignée
// ne doit jamais détourner l'authentification et les données métier vers /chat.
export const API_URL = configuredApiUrl && !configuredApiUrl.includes('fastapicloud.dev')
  ? configuredApiUrl
  : BACKEND_FALLBACK;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers:{'X-LOTISEC-Client':'citizen_web'}
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lotisec_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function authHeaders() {
  const token = localStorage.getItem('lotisec_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
