/**
 * Helper for resolving an event's cover image URL.
 *
 * Purpose: make sure ALL pages (public + dashboard) never render an
 * `<img>` with an empty / 404 src. If the event has no cover image,
 * we fall back to the URL configured via the
 * `NUXT_PUBLIC_DEFAULT_EVENT_IMAGE` env variable.
 *
 * Usage:
 *   import { resolveEventImage } from '~/utils/event-image'
 *   <img :src="resolveEventImage(event.image)" :alt="event.title" @error="onImgError">
 *
 * About the @error handler: even after resolving to the default URL,
 * the default URL itself can 404 (e.g. when the env is not set). Bind
 * an `onImgError` handler in the component to hide the image and show
 * an icon placeholder instead, so the UI never breaks.
 */

/**
 * Resolves the event's cover image URL to a value that's safe to bind
 * to `<img src>`.
 *
 *   - `''`           → falls back to the default (or empty string if
 *                      the env is also empty)
 *   - `'  '`         → treated as empty
 *   - `'https://…'`  → returned as-is
 *   - `null/undef`   → falls back to the default
 *
 * Safe to call in both SSR and client contexts: `useRuntimeConfig()` is
 * read once at module evaluation, with no per-call side effects.
 */
export function resolveEventImage(imageUrl: string | null | undefined): string {
  const fallback = useRuntimeConfig().public.defaultEventImage ?? ''
  if (typeof imageUrl !== 'string') return fallback
  const trimmed = imageUrl.trim()
  if (trimmed.length === 0) return fallback
  return trimmed
}
