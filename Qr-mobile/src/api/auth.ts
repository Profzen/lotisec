import { api } from './config';

export const registerUser = async (
  phone: string,
  password: string
) => {
  // On envoie uniquement phone et password au backend
  return await api('/auth/register', 'POST', { phone, password });
};

export const loginUser = async (phone: string, password: string) => {
  // Le login se fait maintenant aussi via le téléphone
  return await api('/auth/login', 'POST', { phone, password });
};

export const getMe = async (token: string) => {
  return await api('/auth/me', 'GET', undefined, token);
};