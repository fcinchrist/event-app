<script setup lang="ts">
import { useEventCategoryStore } from '~/presentation/stores/event-category'
import type { EventCategory } from '~/domain/entities/event-category'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const store = useEventCategoryStore()
const config = useRuntimeConfig()

// Shared dashboard nav. Kept in sync with the other dashboard pages
// (index / events / users) by convention — the mobile drawer in
// `layouts/default.vue` reuses the same list shape via `NavItem`.
const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'categories', label: 'Master Kategori', icon: 'fa-solid fa-tags', to: '/dashboard/categories' },
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

interface FormState {
  name: string
  detail: string
}

function emptyForm(): FormState {
  return { name: '', detail: '' }
}

const newForm = ref<FormState>(emptyForm())
const localError = ref<string | null>(null)

const showEditModal = ref(false)
const editingCategory = ref<EventCategory | null>(null)

const canCreate = computed(() => newForm.value.name.trim().length >= 2)

// Initial load: flip isLoading to TRUE so the skeleton shows.
onMounted(async () => {
  store.isLoading = true
  await store.fetchCategories()
  store.isLoading = false
})

async function onCreate(): Promise<void> {
  if (!canCreate.value) {
    localError.value = 'Nama kategori wajib diisi (minimal 2 karakter).'
    return
  }
  localError.value = null
  const result = await store.createCategory({
    name: newForm.value.name.trim(),
    detail: newForm.value.detail.trim(),
  })
  if (!result.success) {
    localError.value = result.error ?? 'Gagal membuat kategori.'
    return
  }
  newForm.value = emptyForm()
}

function openEdit(category: EventCategory): void {
  editingCategory.value = category
  showEditModal.value = true
}

async function onDelete(category: EventCategory): Promise<void> {
  // Browser confirm — friendly enough for an admin-only destructive
  // action. The repository already throws a human-readable FK
  // violation error which we surface in the toast/alert.
  const confirmed = window.confirm(
    `Hapus kategori "${category.name}"?\n\nTindakan ini tidak dapat dibatalkan. Jika masih ada event yang memakai kategori ini, operasi akan dibatalkan.`,
  )
  if (!confirmed) return
  const result = await store.deleteCategory(category.id)
  if (!result.success) {
    // The use case already returns a friendly message; reuse it.
    localError.value = result.error ?? 'Gagal menghapus kategori.'
  }
}
</script>

<template>
  <DashboardShell :items="NAV_ITEMS" section-label="Panel Operasional">
    <section class="space-y-5">
      <!-- ============ Header Halaman ============ -->
      <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
            <h2 class="font-extrabold text-2xl text-emerald-700">Master Kategori</h2>
          </div>
          <p class="text-xs text-slate-500">
            Daftar kategori yang dapat dipasang di event komunitas {{ config.public.companyName }}.
            Kategori yang masih dipakai event tidak dapat dihapus.
          </p>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 font-bold">
          <i class="fa-solid fa-tags" />
          <span>Total: {{ store.categories.length }} kategori</span>
        </div>
      </header>

      <!-- ============ Toolbar: Form Tambah ============ -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
        <form class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end" @submit.prevent="onCreate">
          <div class="md:col-span-4">
            <UiFormField
              v-model="newForm.name"
              label="Nama Kategori"
              placeholder="Contoh: Workshop"
              required
            />
          </div>
          <div class="md:col-span-6">
            <UiFormField
              v-model="newForm.detail"
              label="Detail (opsional)"
              placeholder="Deskripsi singkat kategori"
            />
          </div>
          <div class="md:col-span-2">
            <button
              type="submit"
              :disabled="!canCreate || store.isSubmitting"
              class="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-100 flex items-center justify-center gap-1.5"
            >
              <i class="fa-solid fa-plus" />
              Tambah
            </button>
          </div>
        </form>
        <div
          v-if="localError"
          class="mt-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-medium flex items-center gap-2"
        >
          <i class="fa-solid fa-circle-exclamation" />
          {{ localError }}
        </div>
      </div>

      <!-- ============ Error ============ -->
      <div
        v-if="store.error && !localError"
        class="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2"
      >
        <i class="fa-solid fa-circle-exclamation" /> {{ store.error }}
      </div>

      <!-- ============ Loading: Skeleton Tabel ============ -->
      <DashboardCategoriesTableSkeleton v-if="store.isLoading" :rows="5" />

      <!-- ============ Empty State ============ -->
      <div
        v-else-if="store.categories.length === 0"
        class="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm"
      >
        <div class="bg-emerald-50 text-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i class="fa-solid fa-tags text-2xl" />
        </div>
        <h4 class="font-bold text-slate-800 text-lg">Belum Ada Kategori</h4>
        <p class="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Tambahkan kategori pertama di formulir atas untuk mulai menandai event.
        </p>
      </div>

      <!-- ============ Tabel Kategori ============ -->
      <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Header Tabel (desktop only) -->
        <div class="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
          <div class="col-span-4">Nama Kategori</div>
          <div class="col-span-5">Detail</div>
          <div class="col-span-2">ID</div>
          <div class="col-span-1 text-right">Aksi</div>
        </div>

        <!-- Rows -->
        <div class="divide-y divide-slate-100">
          <div
            v-for="category in store.categories"
            :key="category.id"
            class="p-4 md:px-5 md:py-3 hover:bg-slate-50/60 transition-colors"
          >
            <!-- Desktop: 1 baris grid -->
            <div class="hidden md:grid grid-cols-12 gap-3 items-center">
              <div class="col-span-4 min-w-0">
                <p class="font-bold text-slate-900 truncate">{{ category.name }}</p>
              </div>
              <div class="col-span-5 min-w-0">
                <p class="text-sm text-slate-600 truncate">
                  {{ category.detail || '—' }}
                </p>
              </div>
              <div class="col-span-2">
                <p class="text-[11px] text-slate-400 font-mono truncate">{{ category.id }}</p>
              </div>
              <div class="col-span-1 flex justify-end gap-1">
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center justify-center"
                  aria-label="Edit kategori"
                  @click="openEdit(category)"
                >
                  <i class="fa-solid fa-pen text-[11px]" />
                </button>
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-center"
                  aria-label="Hapus kategori"
                  @click="onDelete(category)"
                >
                  <i class="fa-solid fa-trash text-[11px]" />
                </button>
              </div>
            </div>

            <!-- Mobile: card -->
            <div class="md:hidden flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-bold text-slate-900">{{ category.name }}</p>
                <p v-if="category.detail" class="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {{ category.detail }}
                </p>
                <p class="text-[10px] text-slate-400 font-mono mt-1">{{ category.id }}</p>
              </div>
              <div class="flex flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center justify-center"
                  aria-label="Edit kategori"
                  @click="openEdit(category)"
                >
                  <i class="fa-solid fa-pen text-[11px]" />
                </button>
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-center"
                  aria-label="Hapus kategori"
                  @click="onDelete(category)"
                >
                  <i class="fa-solid fa-trash text-[11px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <DashboardEditCategoryModal
      v-model="showEditModal"
      :category="editingCategory"
    />
  </DashboardShell>
</template>
