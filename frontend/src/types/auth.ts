export type UserRole = 'administrador' | 'supervisor' | 'lector';

export type AppUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  companyLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  token: string;
  user: AppUser;
};

export type CreateUserPayload = {
  username: string;
  name: string;
  role: UserRole;
  password: string;
  companyId?: string | null;
};

export type UpdateUserPayload = {
  username?: string;
  name?: string;
  role?: UserRole;
  password?: string;
  companyId?: string | null;
};
