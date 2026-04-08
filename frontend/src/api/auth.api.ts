import { api } from './client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export const authApi = {
  register: (email: string, username: string, password: string) =>
    api.post<TokenPair>('/auth/register', { email, username, password }),

  login: (email: string, password: string) =>
    api.post<TokenPair>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<UserProfile>('/users/me'),
};
