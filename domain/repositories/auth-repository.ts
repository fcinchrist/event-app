export interface AuthUser {
  id: string
  email: string
}

export interface AuthRepository {
  login(email: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  getCurrentUser(): Promise<AuthUser | null>
}
