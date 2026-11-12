// Supabase Client Wrapper for Yasoth Enterprises ERP
// Safely communicates with Supabase Auth, PostgREST & Realtime WebSockets using public anonymous keys.
// NEVER uses or exposes the Supabase Service-Role key in frontend code.

import { createClient, SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const DEFAULT_CONFIG: SupabaseConfig = {
  supabaseUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '',
  supabaseAnonKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '',
};

class SupabaseClientWrapper {
  private config: SupabaseConfig;
  private jsClient: SupabaseJsClient | null = null;

  constructor(config: SupabaseConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.initJsClient();
  }

  private initJsClient(): void {
    if (this.config.supabaseUrl && this.config.supabaseAnonKey) {
      try {
        this.jsClient = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
      } catch (err) {
        console.warn('[SupabaseClientWrapper] Failed to initialize official Supabase JS client:', err);
        this.jsClient = null;
      }
    } else {
      this.jsClient = null;
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.config.supabaseUrl && this.config.supabaseAnonKey);
  }

  public get client(): SupabaseJsClient | null {
    return this.jsClient;
  }

  public get auth() {
    return this.jsClient?.auth ?? null;
  }

  public channel(name: string) {
    if (this.jsClient) {
      return this.jsClient.channel(name);
    }
    return null;
  }

  public removeChannel(channel: any) {
    if (this.jsClient && channel) {
      return this.jsClient.removeChannel(channel);
    }
    return Promise.resolve('ok');
  }

  public from(table: string) {
    if (!this.jsClient) {
      throw new Error(`Cannot query ${table}: Supabase URL or Anon Key not configured.`);
    }
    return this.jsClient.from(table);
  }

  public getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      apikey: this.config.supabaseAnonKey,
      Authorization: `Bearer ${this.config.supabaseAnonKey}`,
    };
  }

  // Supabase Auth: Sign In with Email & Password
  public async signInWithPassword(email: string, password: string): Promise<{ session: any; error: Error | null }> {
    if (!this.isConfigured()) {
      return { session: null, error: new Error('Supabase URL or Anon Key not configured.') };
    }

    if (this.jsClient) {
      const { data, error } = await this.jsClient.auth.signInWithPassword({ email, password });
      if (error) {
        return { session: null, error: new Error(error.message) };
      }
      return { session: data.session, error: null };
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

    if (this.jsClient) {
      const { data, error } = await this.jsClient.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) {
        return { user: null, error: new Error(error.message) };
      }
      return { user: data.user, error: null };
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

    if (this.jsClient) {
      const { error } = await this.jsClient.auth.resetPasswordForEmail(email);
      if (error) {
        return { error: new Error(error.message) };
      }
      return { error: null };
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
  // PostgREST Authoritative PostgreSQL Database API
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

  public async deleteRow(
    table: string,
    matchFilter: Record<string, string>,
    authToken?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    if (!this.isConfigured()) {
      return { success: false, error: new Error('Supabase is not configured.') };
    }

    try {
      const url = new URL(`${this.config.supabaseUrl}/rest/v1/${table}`);
      Object.entries(matchFilter).forEach(([k, v]) => {
        url.searchParams.set(k, v);
      });

      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: this.getDbHeaders(authToken),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: new Error(errJson.message || `HTTP ${res.status}: Failed to delete from ${table}`) };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err };
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

export const supabase = new SupabaseClientWrapper();
