// Supabase Client Wrapper for Yasoth Enterprises ERP
// Safely communicates with Supabase Auth & REST endpoints using public anonymous keys only.
// NEVER uses or exposes the Supabase Service-Role key in frontend code.

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const DEFAULT_CONFIG: SupabaseConfig = {
  supabaseUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '',
  supabaseAnonKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '',
};

class SupabaseClient {
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.supabaseUrl && this.config.supabaseAnonKey);
  }

  public getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      apikey: this.config.supabaseAnonKey,
      Authorization: `Bearer ${this.config.supabaseAnonKey}`,
    };
  }

  // Supabase Auth: Sign In with Email & Password
  public async signInWithPassword(email: string, password: string):Promise<{ session: any; error: Error | null }> {
    if (!this.isConfigured()) {
      return { session: null, error: new Error('Supabase URL or Anon Key not configured.') };
    }

    try {
      const res = await fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { session: null, error: new Error(data.error_description || data.msg || 'Authentication failed') };
      }
      return { session: data, error: null };
    } catch (err: any) {
      return { session: null, error: err };
    }
  }

  // Supabase Auth: Sign Up
  public async signUp(email: string, password: string, metadata: Record<string, any> = {}): Promise<{ user: any; error: Error | null }> {
    if (!this.isConfigured()) {
      return { user: null, error: new Error('Supabase URL or Anon Key not configured.') };
    }

    try {
      const res = await fetch(`${this.config.supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password, data: metadata }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { user: null, error: new Error(data.error_description || data.msg || 'Sign up failed') };
      }
      return { user: data, error: null };
    } catch (err: any) {
      return { user: null, error: err };
    }
  }

  // Supabase Auth: Password Recovery
  public async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    if (!this.isConfigured()) {
      return { error: new Error('Supabase URL or Anon Key not configured.') };
    }

    try {
      const res = await fetch(`${this.config.supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { error: new Error(data.error_description || data.msg || 'Password reset request failed') };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }
}

export const supabase = new SupabaseClient();
