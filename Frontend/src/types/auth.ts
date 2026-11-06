export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

// Khớp response của POST /auth/login và /auth/register (backend/src/auth/auth.service.ts)
export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}
