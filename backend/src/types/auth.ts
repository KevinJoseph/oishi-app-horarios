export type UserRole = 'administrador' | 'lector';

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
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
};

export type UpdateUserPayload = {
  username?: string;
  name?: string;
  role?: UserRole;
  password?: string;
};
