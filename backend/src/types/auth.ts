export type UserRole = 'super_administrador' | 'administrador' | 'supervisor';

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  celular: string | null;
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

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
};

export type ForgotPasswordPayload = {
  username: string;
};

export type ResetPasswordPayload = {
  resetToken: string;
  newPassword: string;
  confirmNewPassword?: string;
};

export type AdminResetPasswordPayload = {
  userId: string;
  newPassword: string;
};

export type ValidateCellphonePayload = {
  celular: string;
};

export type CreateUserPayload = {
  username: string;
  name: string;
  celular?: string | null;
  role: UserRole;
  password: string;
  companyId?: string | null;
};

export type UpdateUserPayload = {
  username?: string;
  name?: string;
  celular?: string | null;
  role?: UserRole;
  password?: string;
  companyId?: string | null;
};
