'use client';

import useSWR, { SWRConfiguration } from 'swr';

/**
 * Universal JSON fetcher for SWR
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorBody = await res.text();
    let message = `API error ${res.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error) message = parsed.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
};

/**
 * Default cache options for static / rarely changing datasets (Courses, Roadmaps, Profile)
 */
const staticDataOptions: SWRConfiguration = {
  revalidateOnFocus: false,        // Don't re-fetch on window/tab focus
  revalidateOnReconnect: false,    // Don't spam on reconnect
  dedupingInterval: 1000 * 60 * 15, // 15 minutes client-side deduping cache
  focusThrottleInterval: 1000 * 60 * 5,
};

/**
 * Default cache options for medium-volatility datasets (Skills, Badges, Aggregations)
 */
const mediumDataOptions: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 1000 * 60 * 5, // 5 minutes client-side deduping cache
};

/**
 * Default cache options for interactive user datasets (Todos, Notifications)
 */
const activeDataOptions: SWRConfiguration = {
  revalidateOnFocus: true,
  dedupingInterval: 1000 * 30, // 30 seconds client-side deduping cache
};

// ─── Custom SWR Hooks with Client-Side In-Memory Caching ──────────────────────

/**
 * Hook for Assigned Courses (Cached in browser memory for 15 mins)
 */
export function useCourses() {
  return useSWR<any[]>('/api/trainer/courses', fetcher, staticDataOptions);
}

/**
 * Hook for Trainer Skills & Badges (Cached in browser memory for 5 mins)
 */
export function useSkills() {
  return useSWR<any>('/api/trainer/skills', fetcher, mediumDataOptions);
}

/**
 * Hook for Trainer Roadmaps (Cached in browser memory for 15 mins)
 */
export function useRoadmaps() {
  return useSWR<any[]>('/api/trainer/roadmaps', fetcher, staticDataOptions);
}

/**
 * Hook for Current Logged-in User Profile (Cached for 15 mins)
 */
export function useCurrentUser() {
  return useSWR<any>('/api/users/me', fetcher, staticDataOptions);
}

/**
 * Hook for Trainer Todos (Cached for 30s with instant optimistic mutation support)
 */
export function useTodos() {
  return useSWR<any[]>('/api/trainer/todos', fetcher, activeDataOptions);
}

/**
 * Hook for Broadcast Announcements (Cached for 2 mins)
 */
export function useAnnouncements() {
  return useSWR<any[]>('/api/notifications/announcements', fetcher, {
    ...mediumDataOptions,
    dedupingInterval: 1000 * 60 * 2,
  });
}
