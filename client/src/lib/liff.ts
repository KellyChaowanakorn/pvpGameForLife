import liff from '@line/liff';

const LIFF_ID = import.meta.env.VITE_LIFF_ID || '2009828596-L0B7X088';

export interface AuthResult {
  token: string;
  user: {
    id: number;
    lineUserId: string;
    displayName: string;
    pictureUrl: string | null;
  };
  wallet: {
    balance: number;
  };
}

// Initialize LIFF
export async function initLiff(): Promise<boolean> {
  try {
    await liff.init({ liffId: LIFF_ID });
    console.log('✅ LIFF initialized');
    return true;
  } catch (err) {
    console.error('❌ LIFF init failed:', err);
    return false;
  }
}

// Check if running inside LINE app
export function isInLine(): boolean {
  return liff.isInClient();
}

// Check if logged in
export function isLoggedIn(): boolean {
  return liff.isLoggedIn();
}

// Login with LINE
export function lineLogin(): void {
  liff.login();
}

// Get access token
export function getAccessToken(): string | null {
  return liff.getAccessToken();
}

// Login to our server with LINE access token
export async function loginToServer(): Promise<AuthResult | null> {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      console.error('No LINE access token');
      return null;
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });

    if (!res.ok) throw new Error('Login failed');
    return await res.json();
  } catch (err) {
    console.error('Server login error:', err);
    return null;
  }
}

// Dev login (no LINE needed)
export async function devLoginToServer(name?: string): Promise<AuthResult | null> {
  try {
    const res = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) throw new Error('Dev login failed');
    return await res.json();
  } catch (err) {
    console.error('Dev login error:', err);
    return null;
  }
}

// Full login flow
export async function fullLoginFlow(): Promise<AuthResult | null> {
  // Try LIFF first
  const liffReady = await initLiff();

  if (liffReady && isLoggedIn()) {
    // Logged in via LINE — authenticate with server
    console.log('📱 LINE user detected, logging in...');
    const result = await loginToServer();
    if (result) return result;
  }

  if (liffReady && isInLine() && !isLoggedIn()) {
    // Inside LINE app but not logged in — trigger login
    lineLogin();
    return null; // page will redirect
  }

  // Not in LINE (desktop/browser) — use dev login
  console.log('🖥️ Not in LINE, using dev login');
  return await devLoginToServer();
}
