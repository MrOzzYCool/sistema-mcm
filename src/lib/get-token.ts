import { supabase } from "./supabase";

/**
 * Cached token getter — prevents parallel getSession() calls that cause
 * "Lock was released because another request stole it" errors.
 */
let cachedToken: string | null = null;
let tokenExpiry = 0;
let pendingPromise: Promise<string | null> | null = null;

export async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  // If there's already a pending getSession call, wait for it
  if (pendingPromise) {
    return pendingPromise;
  }

  // Make the call
  pendingPromise = supabase.auth.getSession()
    .then(({ data: { session } }) => {
      if (session?.access_token) {
        cachedToken = session.access_token;
        // JWT expiry is typically 1 hour, cache for 50 minutes
        tokenExpiry = Date.now() + 50 * 60 * 1000;
      } else {
        cachedToken = null;
        tokenExpiry = 0;
      }
      return cachedToken;
    })
    .catch(() => {
      cachedToken = null;
      tokenExpiry = 0;
      return null;
    })
    .finally(() => {
      pendingPromise = null;
    });

  return pendingPromise;
}

/** Clear cached token (call on logout) */
export function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
}
