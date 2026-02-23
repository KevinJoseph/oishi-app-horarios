export type UserRole = 'administrador' | 'lector';

export type AppUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
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
};

export type UpdateUserPayload = {
  username?: string;
  name?: string;
  role?: UserRole;
  password?: string;
};
