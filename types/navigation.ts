/**
 * Shared navigation item shape used by both the dashboard sidebar
 * (`DashboardShell`) and the global mobile drawer (`layouts/default`).
 */
export interface NavItem {
  key: string
  label: string
  icon: string
  to: string
}
