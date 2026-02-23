import { request } from './http';
import type { AppUser, CreateUserPayload, UpdateUserPayload } from '../types/auth';

export function fetchUsers(): Promise<AppUser[]> {
  return request<AppUser[]>('/users');
}

export function createUser(payload: CreateUserPayload): Promise<AppUser> {
  return request<AppUser>('/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<AppUser> {
  return request<AppUser>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteUser(id: string): Promise<void> {
  return request<void>(`/users/${id}`, {
    method: 'DELETE'
  });
}
