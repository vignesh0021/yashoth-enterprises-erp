/**
 * YASHOTH ENTERPRISES ERP — AUTHORITATIVE REALTIME SYNCHRONIZATION SERVICE
 *
 * Implements:
 * 1. Supabase Realtime WebSocket subscriptions (@supabase/supabase-js)
 * 2. Strict company-scoped event filtering for authorized business tables
 * 3. Connection status, automatic reconnection with exponential backoff & cleanup
 * 4. Duplicate event filtering to avoid redundant processing & double financial postings
 * 5. Fallback polling when offline or WebSocket disconnected
 */

import { supabase } from './supabaseClient.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeSyncStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export type RealtimeTable =
  | 'cash_bank_accounts'
  | 'inventory_lots'
  | 'stock_movements'
  | 'payments'
  | 'payment_allocations'
  | 'journal_entries'
  | 'journal_lines'
  | 'parties'
  | 'weighments'
  | 'invoices'
  | 'purchase_headers';

export interface RealtimeChangeEvent<T = any> {
  table: RealtimeTable;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRecord: T | null;
  oldRecord: Partial<T> | null;
  companyId: string;
  timestamp: string;
}

export type RealtimeListener = (event: RealtimeChangeEvent) => void;

class RealtimeSyncService {
  private static instance: RealtimeSyncService;
  private channel: RealtimeChannel | null = null;
  private activeCompanyId: string | null = null;
  private status: RealtimeSyncStatus = 'DISCONNECTED';
  private statusListeners: Set<(status: RealtimeSyncStatus) => void> = new Set();
  private tableListeners: Map<RealtimeTable, Set<RealtimeListener>> = new Map();
  private processedEventIds: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private fallbackPollTimer: any = null;
  private isFallbackPollingActive: boolean = false;

  public static getInstance(): RealtimeSyncService {
    if (!RealtimeSyncService.instance) {
      RealtimeSyncService.instance = new RealtimeSyncService();
    }
    return RealtimeSyncService.instance;
  }

  public getStatus(): RealtimeSyncStatus {
    return this.status;
  }

  public subscribeStatus(listener: (status: RealtimeSyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: RealtimeSyncStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((l) => l(status));
    }
  }

  // --------------------------------------------------------------------------
  // TABLE EVENT SUBSCRIPTIONS
  // --------------------------------------------------------------------------
  public onTableChange(table: RealtimeTable, listener: RealtimeListener): () => void {
    if (!this.tableListeners.has(table)) {
      this.tableListeners.set(table, new Set());
    }
    this.tableListeners.get(table)!.add(listener);
    return () => {
      this.tableListeners.get(table)?.delete(listener);
    };
  }

  private dispatchEvent(event: RealtimeChangeEvent): void {
    // 1. Generate unique deterministic event signature to prevent duplicate execution
    const eventKey = `${event.table}-${event.eventType}-${event.newRecord?.id || event.oldRecord?.id}-${event.timestamp}`;
    if (this.processedEventIds.has(eventKey)) {
      return;
    }
    this.processedEventIds.add(eventKey);

    // Keep processed event memory bounded (max 500 recent events)
    if (this.processedEventIds.size > 500) {
      const first = this.processedEventIds.values().next().value;
      if (first) this.processedEventIds.delete(first);
    }

    // 2. Dispatch to registered listeners
    const listeners = this.tableListeners.get(event.table);
    if (listeners && listeners.size > 0) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error(`[RealtimeSync] Error in listener for table ${event.table}:`, err);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE: CONNECT & SUBSCRIBE
  // --------------------------------------------------------------------------
  public initializeCompanySync(companyId: string): void {
    if (!companyId) return;

    // If already connected to this company, do not re-create duplicate channel
    if (this.activeCompanyId === companyId && this.channel && this.status === 'CONNECTED') {
      return;
    }

    this.cleanupSubscriptions();
    this.activeCompanyId = companyId;

    if (!supabase.isConfigured()) {
      this.setStatus('DISCONNECTED');
      this.startFallbackPolling();
      return;
    }

    this.setStatus('CONNECTING');
    this.connectRealtimeChannel(companyId);
  }

  private connectRealtimeChannel(companyId: string): void {
    try {
      const channelName = `company-realtime-${companyId}`;
      const channel = supabase.channel(channelName);

      if (!channel) {
        this.setStatus('DISCONNECTED');
        this.startFallbackPolling();
        return;
      }

      const tablesToListen: RealtimeTable[] = [
        'cash_bank_accounts',
        'inventory_lots',
        'stock_movements',
        'payments',
        'payment_allocations',
        'journal_entries',
        'journal_lines',
        'parties',
        'weighments',
        'invoices',
        'purchase_headers',
      ];

      // Bind Postgres change handlers for all authorized business tables
      tablesToListen.forEach((tbl) => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tbl,
            filter: `company_id=eq.${companyId}`,
          },
          (payload: any) => {
            const event: RealtimeChangeEvent = {
              table: tbl,
              eventType: payload.eventType,
              newRecord: payload.new,
              oldRecord: payload.old,
              companyId,
              timestamp: payload.commit_timestamp || new Date().toISOString(),
            };
            this.dispatchEvent(event);
          }
        );
      });

      channel.subscribe((status: string, err?: Error) => {
        if (status === 'SUBSCRIBED') {
          this.setStatus('CONNECTED');
          this.reconnectAttempts = 0;
          this.stopFallbackPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.setStatus('RECONNECTING');
          this.scheduleReconnect(companyId);
          this.startFallbackPolling();
        }
      });

      this.channel = channel;
    } catch (err) {
      console.warn('[RealtimeSync] WebSocket connection error, scheduling retry:', err);
      this.setStatus('ERROR');
      this.scheduleReconnect(companyId);
      this.startFallbackPolling();
    }
  }

  private scheduleReconnect(companyId: string): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s max
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.activeCompanyId === companyId) {
        this.connectRealtimeChannel(companyId);
      }
    }, delay);
  }

  // --------------------------------------------------------------------------
  // FALLBACK POLLING (WHEN WEBSOCKET IS CLOSED OR OFFLINE)
  // --------------------------------------------------------------------------
  private startFallbackPolling(): void {
    if (this.isFallbackPollingActive) return;
    this.isFallbackPollingActive = true;

    // Check every 30 seconds for recent changes via PostgREST
    this.fallbackPollTimer = setInterval(() => {
      if (this.activeCompanyId && supabase.isConfigured() && this.status !== 'CONNECTED') {
        this.pollRecentUpdates(this.activeCompanyId);
      }
    }, 30000);
  }

  private stopFallbackPolling(): void {
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
    this.isFallbackPollingActive = false;
  }

  private async pollRecentUpdates(companyId: string): Promise<void> {
    try {
      // Query recent weighments as heartbeat poll
      const res = await supabase.queryTable('weighments', {
        filters: { company_id: `eq.${companyId}` },
      });
      if (res.data) {
        // If poll succeeds, server is reachable; attempt to restore WebSocket
        if (this.status === 'ERROR' || this.status === 'DISCONNECTED') {
          this.setStatus('RECONNECTING');
          this.connectRealtimeChannel(companyId);
        }
      }
    } catch {
      // Still offline
    }
  }

  // --------------------------------------------------------------------------
  // CLEANUP
  // --------------------------------------------------------------------------
  public cleanupSubscriptions(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopFallbackPolling();

    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch (e) {
        console.warn('[RealtimeSync] Error removing channel:', e);
      }
      this.channel = null;
    }
    this.activeCompanyId = null;
    this.setStatus('DISCONNECTED');
  }
}

export const realtimeSyncService = RealtimeSyncService.getInstance();
