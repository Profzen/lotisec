import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

export function authHeaders() {
  const token = localStorage.getItem('lotisec_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
