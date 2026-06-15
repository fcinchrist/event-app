/**
 * Domain entity for the master event category.
 *
 * Categories are admin-managed and shared across events. The `id`
 * is a human-readable string of the form `CAT-YYYY-NNNNN`, generated
 * by the application/infrastructure layer (see `generateUniqueId`).
 */
export interface EventCategory {
  id: string
  name: string
  detail: string
  createdAt: string
  updatedAt: string
}

/**
 * Input shape for creating or updating a category. Both fields are
 * trimmed and validated by the use case; the repository trusts them.
 */
export interface EventCategoryFormData {
  name: string
  detail: string
}
