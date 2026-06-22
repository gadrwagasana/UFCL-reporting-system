import { post, get } from './client';
import { EP } from './endpoints';
import { LoginRequest, LoginResponse, User } from '../types/auth';

export async function loginApi(creds: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>(EP.AUTH_LOGIN, creds);
}

export async function meApi(): Promise<User & { ok: true }> {
  return get<User & { ok: true }>(EP.AUTH_ME);
}

export async function changePasswordApi(oldPassword: string, newPassword: string): Promise<{ ok: true }> {
  return post<{ ok: true }>(EP.AUTH_CHANGE_PW, { oldPassword, newPassword });
}
