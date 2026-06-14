import { ref } from 'vue'

/**
 * Composable untuk state drawer navigasi mobile (satu hamburger, satu drawer).
 *
 * Komponen-komponen yang menggunakan:
 * - LayoutAppHeader    → trigger toggle (emit `toggle-nav`)
 * - AppHeader (event)  → open/close
 * - layout default     → render drawer publik (Home, Login, Logout)
 * - DashboardShell     → render drawer dashboard (Ringkasan, Kelola Event, Logout)
 *
 * Karena sekarang hamburger navbar dipakai untuk **semua halaman**
 * (publik maupun dashboard), drawer harus berisi SEMUA menu yang relevan
 * dalam satu tempat — supaya user tidak bingung mencari menu di dua tempat.
 *
 * State disimpan di module-level ref (singleton) sehingga semua komponen
 * yang mengimpor composable ini melihat nilai yang sama.
 */
const isOpen = ref(false)

export function useMobileNav() {
  function open(): void {
    isOpen.value = true
  }
  function close(): void {
    isOpen.value = false
  }
  function toggle(): void {
    isOpen.value = !isOpen.value
  }
  return { isOpen, open, close, toggle }
}
