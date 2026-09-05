/**
 * In-Memory Rate Limiting & Cooldown Manager
 *
 * Provides per-key cooldown protection to defend against DoS,
 * rapid successive API triggers, and scraper/API quota exhaustion.
 */

const cooldownStore = new Map<string, number>();

export interface CooldownResult {
  allowed: boolean;
  remainingSeconds: number;
}

/**
 * Check if a cooldown is currently active for the given key.
 *
 * @param key Unique key (e.g. `scrape:contest:<id>`, `scrape:user:<id>`)
 * @param cooldownMs Cooldown window in milliseconds (default: 60,000 ms = 60s)
 */
export function checkCooldown(key: string, cooldownMs: number = 60_000): CooldownResult {
  const now = Date.now();
  const lastTime = cooldownStore.get(key);

  if (lastTime && now - lastTime < cooldownMs) {
    const remainingMs = cooldownMs - (now - lastTime);
    return {
      allowed: false,
      remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    };
  }

  return {
    allowed: true,
    remainingSeconds: 0,
  };
}

/**
 * Record a trigger event for the given key, resetting its cooldown timer.
 *
 * @param key Unique key
 */
export function recordCooldown(key: string): void {
  cooldownStore.set(key, Date.now());

  // Prevent memory leaks by pruning entries older than 10 minutes
  if (cooldownStore.size > 1000) {
    const cutoff = Date.now() - 600_000;
    for (const [k, timestamp] of cooldownStore.entries()) {
      if (timestamp < cutoff) {
        cooldownStore.delete(k);
      }
    }
  }
}

/**
 * Reset cooldown for a given key (primarily used in testing).
 */
export function resetCooldown(key?: string): void {
  if (key) {
    cooldownStore.delete(key);
  } else {
    cooldownStore.clear();
  }
}
