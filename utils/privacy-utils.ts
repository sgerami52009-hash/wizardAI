/**
 * Privacy utilities for safe logging and data handling
 * Safety: Strip PII before any logging operations
 * Performance: Minimal overhead for privacy operations
 */

export interface SanitizationConfig {
  preserveLength: boolean;
  maskCharacter: string;
  allowedPatterns: RegExp[];
}

const DEFAULT_CONFIG: SanitizationConfig = {
  preserveLength: true,
  maskCharacter: '*',
  allowedPatterns: []
};

/**
 * Sanitize text for logging by removing/masking PII
 */
export function sanitizeForLog(
  text: string, 
  config: Partial<SanitizationConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!text || typeof text !== 'string') {
    return '[invalid-input]';
  }

  let sanitized = text;

  // Remove email addresses
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    finalConfig.preserveLength ? '[email-redacted]' : '[email]'
  );

  // Remove phone numbers
  sanitized = sanitized.replace(
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    finalConfig.preserveLength ? '[phone-redacted]' : '[phone]'
  );

  // Remove potential names (capitalized words that might be names)
  sanitized = sanitized.replace(
    /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g,
    finalConfig.preserveLength ? '[name-redacted]' : '[name]'
  );

  // Remove addresses (basic pattern)
  sanitized = sanitized.replace(
    /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln)\b/gi,
    finalConfig.preserveLength ? '[address-redacted]' : '[address]'
  );

  return sanitized;
}

/**
 * Check if text contains potential PII
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const piiPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/ // Credit card
  ];

  return piiPatterns.some(pattern => pattern.test(text));
}

/**
 * Generate anonymous identifier for tracking without PII
 */
export function generateAnonymousId(seed?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  const seedHash = seed ? hashString(seed).toString(36) : '';
  
  return `anon_${timestamp}_${random}_${seedHash}`.substr(0, 32);
}

/**
 * Simple hash function for generating consistent IDs
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}