import { request } from './http';
import type { AppUser, LoginResponse } from '../types/auth';

export function login(payload: { username: string; password: string }): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function fetchCurrentUser(): Promise<AppUser> {
  return request<AppUser>('/auth/me');
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST'
  });
}
