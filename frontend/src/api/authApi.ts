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

export function requestPasswordReset(payload: { username: string }): Promise<{ message: string; resetToken: string; expiresAt: string }> {
  return request<{ message: string; resetToken: string; expiresAt: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function resetPassword(payload: {
  resetToken: string;
  newPassword: string;
  confirmNewPassword?: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
