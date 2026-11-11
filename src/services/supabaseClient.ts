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

  // --------------------------------------------------------------------------
  // PostgREST Authoritative PostgreSQL Database API (Uses Public Anon Key + Bearer JWT)
  // --------------------------------------------------------------------------

  public getDbHeaders(authToken?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: this.config.supabaseAnonKey,
      Prefer: 'return=representation',
    };
    if (authToken && authToken.startsWith('tok_') === false) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else {
      headers['Authorization'] = `Bearer ${this.config.supabaseAnonKey}`;
    }
    return headers;
  }

  public async queryTable<T = any>(
    table: string,
    params: {
      select?: string;
      filters?: Record<string, string>;
      authToken?: string;
    } = {}
  ): Promise<{ data: T[] | null; error: Error | null }> {
    if (!this.isConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const url = new URL(`${this.config.supabaseUrl}/rest/v1/${table}`);
      if (params.select) {
        url.searchParams.set('select', params.select);
      }
      if (params.filters) {
        Object.entries(params.filters).forEach(([k, v]) => {
          url.searchParams.set(k, v);
        });
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getDbHeaders(params.authToken),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { data: null, error: new Error(errJson.message || `HTTP ${res.status}: Failed to query ${table}`) };
      }

      const data = await res.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  public async insertRow<T = any>(
    table: string,
    payload: any,
    authToken?: string
  ): Promise<{ data: T | null; error: Error | null }> {
    if (!this.isConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const res = await fetch(`${this.config.supabaseUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: this.getDbHeaders(authToken),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { data: null, error: new Error(errJson.message || `HTTP ${res.status}: Failed to insert into ${table}`) };
      }

      const rows = await res.json();
      return { data: Array.isArray(rows) ? rows[0] : rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  public async updateRow<T = any>(
    table: string,
    matchFilter: Record<string, string>,
    payload: any,
    authToken?: string
  ): Promise<{ data: T | null; error: Error | null }> {
    if (!this.isConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const url = new URL(`${this.config.supabaseUrl}/rest/v1/${table}`);
      Object.entries(matchFilter).forEach(([k, v]) => {
        url.searchParams.set(k, v);
      });

      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: this.getDbHeaders(authToken),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { data: null, error: new Error(errJson.message || `HTTP ${res.status}: Failed to update ${table}`) };
      }

      const rows = await res.json();
      return { data: Array.isArray(rows) ? rows[0] : rows, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  public async executeRpc<T = any>(
    functionName: string,
    params: Record<string, any> = {},
    authToken?: string
  ): Promise<{ data: T | null; error: Error | null }> {
    if (!this.isConfigured()) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    try {
      const res = await fetch(`${this.config.supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: this.getDbHeaders(authToken),
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { data: null, error: new Error(errJson.message || `HTTP ${res.status}: RPC ${functionName} failed`) };
      }

      const data = await res.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
}

export const supabase = new SupabaseClient();

