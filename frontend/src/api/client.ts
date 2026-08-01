import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://lotisec-backend.vercel.app';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
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
