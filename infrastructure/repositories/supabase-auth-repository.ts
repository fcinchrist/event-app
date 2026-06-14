import type { AuthRepository, AuthUser } from '~/domain/repositories/auth-repository'
import { useSupabaseClient } from '~/infrastructure/supabase/client'

export class SupabaseAuthRepository implements AuthRepository {
  async login(email: string, password: string): Promise<AuthUser> {
    const supabase = useSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Login failed: no user returned.')
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
    }
  }

  async logout(): Promise<void> {
    const supabase = useSupabaseClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = useSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    return {
      id: user.id,
      email: user.email ?? '',
    }
  }
}
