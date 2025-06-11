/**
 * JWT Token utilities for client-side token decoding
 */

interface JWTPayload {
  sub: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Decode JWT token payload without verification (client-side only)
 * Note: This is for convenience only. Server-side verification is still required for security.
 */
export const decodeJWTPayload = (token: string): JWTPayload | null => {
  try {
    // JWT consists of three parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }

    // Decode the payload (base64url)
    const payload = parts[1];

    // Add padding if needed for proper base64 decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);

    // Replace URL-safe characters
    const base64 = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');

    // Decode and parse JSON
    const decodedPayload = JSON.parse(atob(base64));

    return decodedPayload as JWTPayload;
  } catch (error) {
    console.error('Error decoding JWT payload:', error);
    return null;
  }
};

/**
 * Extract username from JWT token
 */
export const getUsernameFromToken = (token: string): string | null => {
  const payload = decodeJWTPayload(token);
  return payload?.username || null;
};

/**
 * Check if JWT token is expired (client-side check only)
 * Note: This is for UX only. Server-side verification is still required.
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJWTPayload(token);
  if (!payload?.exp) {
    return true; // If no expiration, consider it expired for safety
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
};
