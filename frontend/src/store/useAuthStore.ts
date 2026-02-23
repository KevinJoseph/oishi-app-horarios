import { create } from 'zustand';
import { fetchCurrentUser, login as loginApi, logout as logoutApi } from '../api/authApi';
import { ApiError, clearStoredToken, getStoredToken, setStoredToken } from '../api/http';
import type { AppUser } from '../types/auth';

type AuthState = {
  token: string | null;
  currentUser: AppUser | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  currentUser: null,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    if (get().initialized || get().loading) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      set({ token: null, currentUser: null, initialized: true, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const user = await fetchCurrentUser();
      set({ token, currentUser: user, initialized: true, loading: false, error: null });
    } catch {
      clearStoredToken();
      set({ token: null, currentUser: null, initialized: true, loading: false, error: 'Sesión expirada.' });
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const result = await loginApi({ username, password });
      setStoredToken(result.token);
      set({
        token: result.token,
        currentUser: result.user,
        initialized: true,
        loading: false,
        error: null
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.';
      set({ loading: false, error: message });
      throw error;
    }
  },

  logout: async () => {
    const token = get().token;
    set({ loading: true });
    try {
      if (token) {
        await logoutApi();
      }
    } catch {
      // En logout limpiamos cliente aunque el backend falle.
    } finally {
      clearStoredToken();
      set({ token: null, currentUser: null, initialized: true, loading: false, error: null });
    }
  }
}));
