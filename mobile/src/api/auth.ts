import { post, get } from './client';
import { EP } from './endpoints';
import { LoginRequest, LoginResponse, User } from '../types/auth';

export async function loginApi(creds: LoginRequest): Promise<LoginResponse> {
  return post<LoginResponse>(EP.AUTH_LOGIN, creds);
}

export async function meApi(): Promise<{ ok: true; user: User }> {
  return get<{ ok: true; user: User }>(EP.AUTH_ME);
}
