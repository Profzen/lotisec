import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, registerUser } from '../api/auth';

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Inscription simplifiée : Téléphone + Mot de passe uniquement
   */
  const register = async (phone: string, password: string, email?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await registerUser(phone, password);
      
      // On récupère le token peu importe le nom donné par l'API (token ou access_token)
      const tokenValue = data.token || data.access_token;

      if (tokenValue) {
        await AsyncStorage.setItem('token', tokenValue);
        // On sauvegarde l'objet utilisateur s'il existe dans la réponse
        if (data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(data.user));
        }
      }
      
      return data;
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'inscription");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Connexion via téléphone
   */
  const login = async (phone: string, password: string, email?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await loginUser(phone, password);
      
      const tokenValue = data.token || data.access_token;

      if (tokenValue) {
        await AsyncStorage.setItem('token', tokenValue);
        if (data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(data.user));
        }
      }
      
      return data;
    } catch (err: any) {
      setError(err.message || "Erreur lors de la connexion");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('qrToken'); // On nettoie aussi le token du QR
    } catch (e) {
      console.error("Erreur lors de la déconnexion", e);
    }
  };

  const getToken = async () => {
    return await AsyncStorage.getItem('token');
  };

  const getUser = async () => {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };

  return { register, login, logout, getToken, getUser, loading, error };
};