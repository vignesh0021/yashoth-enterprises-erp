/**
 * YASHOTH ENTERPRISES ERP — SECURE GOOGLE DRIVE INTEGRATION
 *
 * Implements client-side OAuth 2.0 via Google Identity Services (GIS) token client.
 * Security Compliance:
 * - NEVER uses or exposes client secrets or service-role keys in frontend code.
 * - Restricts scope strictly to 'https://www.googleapis.com/auth/drive.file' (only files created by YE ERP).
 * - Implements graceful offline / simulated fallbacks when Google Client ID is unconfigured.
 */

export interface GoogleDriveConfig {
  clientId: string;
  scope: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
}

export interface GoogleDriveStatus {
  isConnected: boolean;
  userEmail?: string;
  hasClientId: boolean;
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private userEmail: string | null = null;
  private customClientId: string = '';

  constructor() {
    this.customClientId = localStorage.getItem('ye_gdrive_client_id') || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  }

  public setClientId(clientId: string): void {
    this.customClientId = clientId.trim();
    localStorage.setItem('ye_gdrive_client_id', this.customClientId);
  }

  public getClientId(): string {
    return this.customClientId;
  }

  public isConfigured(): boolean {
    return !!this.customClientId;
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public getStatus(): GoogleDriveStatus {
    return {
      isConnected: !!this.accessToken,
      userEmail: this.userEmail || undefined,
      hasClientId: this.isConfigured(),
    };
  }

  /**
   * Initializes GIS OAuth Token Client.
   * Google Identity Services script is dynamically loaded if present.
   */
  public async initClient(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!this.customClientId) {
      return false;
    }

    // Check if google accounts script is loaded
    if (!(window as any).google?.accounts?.oauth2) {
      await this.loadGsiScript();
    }

    if ((window as any).google?.accounts?.oauth2) {
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: this.customClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse?.access_token) {
            this.accessToken = tokenResponse.access_token;
          }
        },
      });
      return true;
    }

    return false;
  }

  private loadGsiScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById('google-gsi-script')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => resolve(); // Graceful on network failure / offline
      document.head.appendChild(script);
    });
  }

  /**
   * Triggers the interactive Google sign-in consent modal.
   */
  public async signIn(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Google OAuth Client ID is not configured. Please enter your Google Cloud Web Client ID in Backup Settings.',
      };
    }

    await this.initClient();

    if (!this.tokenClient) {
      return {
        success: false,
        error: 'Unable to initialize Google OAuth client. Ensure network access to accounts.google.com.',
      };
    }

    return new Promise((resolve) => {
      try {
        this.tokenClient.callback = (tokenResponse: any) => {
          if (tokenResponse.error) {
            resolve({ success: false, error: tokenResponse.error_description || tokenResponse.error });
            return;
          }
          this.accessToken = tokenResponse.access_token;
          resolve({ success: true });
        };
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'Google Sign-in failed.' });
      }
    });
  }

  public signOut(): void {
    if (this.accessToken && (window as any).google?.accounts?.oauth2) {
      (window as any).google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.userEmail = null;
  }

  /**
   * Uploads backup file to Google Drive using standard REST v3 multipart upload.
   */
  public async uploadBackupFile(
    filename: string,
    content: string,
    mimeType: string = 'application/json'
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Google Drive is not authenticated. Please connect your Google account first.' };
    }

    try {
      const metadata = {
        name: filename,
        mimeType: mimeType,
        description: 'Yashoth Enterprises ERP Automated Backup',
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        content +
        closeDelim;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to upload to Google Drive.`);
      }

      const fileData = await response.json();
      return { success: true, fileId: fileData.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upload backup to Google Drive.' };
    }
  }

  /**
   * Lists backup files created by this ERP in Google Drive.
   */
  public async listBackups(): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) return [];

    try {
      const query = encodeURIComponent("name contains 'YE_' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime)&orderBy=createdTime desc`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.files || [];
    } catch {
      return [];
    }
  }

  /**
   * Downloads a backup file from Google Drive by ID.
   */
  public async downloadFile(fileId: string): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated with Google Drive.' };
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: HTTP ${response.status}`);
      }

      const content = await response.text();
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message || 'Download failed.' };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
