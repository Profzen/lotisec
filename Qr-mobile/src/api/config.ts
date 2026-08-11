import AsyncStorage from '@react-native-async-storage/async-storage';

const fallbackApiUrl = 'https://lotisec-backend.vercel.app';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl).replace(/\/$/, '');

export const api = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: object,
  token?: string
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-LOTISEC-Client':'mobile',
  };

  const effectiveToken = token || await AsyncStorage.getItem('token');
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
  }

  const finalUrl: string = `${API_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const response = await fetch(finalUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    console.log(`[API] ${method} ${finalUrl} - Status: ${response.status}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || 'Réponse invalide du serveur');
    }

    if (!response.ok) {
      const errorMessage = data?.detail || data?.error || data?.message || `Erreur ${response.status}`;
      throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }

    return data;
  } catch (err: any) {
    if (err.message) throw err;
    throw new Error('Impossible de contacter le serveur');
  }
};
