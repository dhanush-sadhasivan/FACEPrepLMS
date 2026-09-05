import crypto from 'crypto';

/**
 * Generates a cryptographically secure temporary password.
 * Uses crypto.randomBytes(8) to generate high-entropy randomness, appended with 'A1!'
 * to satisfy standard complexity requirements (uppercase, numbers, symbols).
 */
export function generateSecureTempPassword(): string {
  return crypto.randomBytes(8).toString('hex') + 'A1!';
}

/**
 * Constant-time string comparison to mitigate timing side-channel attacks.
 * Verifies equal buffer lengths before calling crypto.timingSafeEqual.
 */
export function safeTimingCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sanitizes CSV cell values to prevent CSV formula injection (CWE-1236 / Formula Injection).
 * If a string begins with dangerous prefix characters (=, +, -, @, \t, \r),
 * it is prepended with a single quote (') to force spreadsheet processors
 * (Excel, Calc, Google Sheets) to treat the cell as raw text.
 */
export function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
  if (str.length > 0 && formulaChars.includes(str.charAt(0))) {
    return "'" + str;
  }
  return str;
}

/**
 * Sanitizes all string fields in an object for CSV/Excel export.
 */
export function sanitizeCsvRow<T extends Record<string, any>>(row: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      result[key] = sanitizeCsvCell(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value === null || value === undefined) {
      result[key] = value;
    } else {
      result[key] = sanitizeCsvCell(String(value));
    }
  }
  return result;
}

const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates that an identifier (username handle, problem slug, contest slug)
 * consists strictly of safe alphanumeric and hyphen/underscore characters.
 */
export function isValidIdentifier(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return SAFE_IDENTIFIER_REGEX.test(val.trim());
}

/**
 * SSRF & Open Redirect Protection:
 * Validates a target redirect or fetch URL against allowed protocols, hostname allowlists,
 * and private/loopback/cloud-metadata IP ranges.
 */
export function isSafeRedirectUrl(urlStr: string, allowedHosts?: string[]): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const trimmed = urlStr.trim();
    // Allow relative paths starting with '/' but not '//'
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return true;
    }

    const parsed = new URL(trimmed);
    // Enforce https protocol only for external URLs
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block loopback, localhost, and cloud metadata hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    // Check private IPv4 ranges:
    // 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 0.0.0.0/8
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);
      if (octet1 === 10) return false;
      if (octet1 === 127) return false;
      if (octet1 === 169 && octet2 === 254) return false;
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return false;
      if (octet1 === 192 && octet2 === 168) return false;
      if (octet1 === 0) return false;
    }

    // Default allowed domains for training, contests, and problem solving
    const defaultAllowedDomains = [
      'hackerrank.com',
      'www.hackerrank.com',
      'leetcode.com',
      'www.leetcode.com',
      'github.com',
      'www.github.com',
      'faceprep.in',
      'www.faceprep.in',
    ];

    const hostAllowlist = allowedHosts || defaultAllowedDomains;

    const isAllowed = hostAllowlist.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );

    return isAllowed;
  } catch {
    return false;
  }
}

