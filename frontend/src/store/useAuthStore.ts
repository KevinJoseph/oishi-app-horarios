import { create } from 'zustand';
import { fetchCurrentUser, login as loginApi, logout as logoutApi } from '../api/authApi';
import { ApiError, clearStoredToken, getStoredToken, setStoredToken } from '../api/http';
import type { AppUser } from '../types/auth';

const GEOVICTORIA_COMPANY_ID_STORAGE_KEY = 'app_horario2_geo_company_id';
const GEOVICTORIA_COMPANY_LABEL_STORAGE_KEY = 'app_horario2_geo_company_label';

function getStoredGeoVictoriaCompanyId(): string | null {
  return localStorage.getItem(GEOVICTORIA_COMPANY_ID_STORAGE_KEY);
}

function getStoredGeoVictoriaCompanyLabel(): string | null {
  return localStorage.getItem(GEOVICTORIA_COMPANY_LABEL_STORAGE_KEY);
}

function setStoredGeoVictoriaCompany(companyId: string | null, companyLabel: string | null): void {
  if (companyId) {
    localStorage.setItem(GEOVICTORIA_COMPANY_ID_STORAGE_KEY, companyId);
  } else {
    localStorage.removeItem(GEOVICTORIA_COMPANY_ID_STORAGE_KEY);
  }

  if (companyLabel) {
    localStorage.setItem(GEOVICTORIA_COMPANY_LABEL_STORAGE_KEY, companyLabel);
  } else {
    localStorage.removeItem(GEOVICTORIA_COMPANY_LABEL_STORAGE_KEY);
  }
}

type AuthState = {
  token: string | null;
  currentUser: AppUser | null;
  selectedGeoVictoriaCompanyId: string | null;
  selectedGeoVictoriaCompanyLabel: string | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  setSelectedGeoVictoriaCompany: (companyId: string | null, companyLabel: string | null) => void;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  currentUser: null,
  selectedGeoVictoriaCompanyId: getStoredGeoVictoriaCompanyId(),
  selectedGeoVictoriaCompanyLabel: getStoredGeoVictoriaCompanyLabel(),
  initialized: false,
  loading: false,
  error: null,

  setSelectedGeoVictoriaCompany: (companyId, companyLabel) => {
    setStoredGeoVictoriaCompany(companyId, companyLabel);
    set({
      selectedGeoVictoriaCompanyId: companyId,
      selectedGeoVictoriaCompanyLabel: companyLabel
    });
  },

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
      setStoredGeoVictoriaCompany(null, null);
      set({
        token: null,
        currentUser: null,
        selectedGeoVictoriaCompanyId: null,
        selectedGeoVictoriaCompanyLabel: null,
        initialized: true,
        loading: false,
        error: null
      });
    }
  }
}));
