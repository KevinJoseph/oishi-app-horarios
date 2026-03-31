export type UserRole = 'administrador' | 'supervisor' | 'lector';

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  companyLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoginPayload = {
  username: string;
  password: string;
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
