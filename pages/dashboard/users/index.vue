<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useUserStore } from '~/presentation/stores/user'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'
import {
  MEMBER_TYPE_LABELS,
  USER_STATUS_LABELS,
  type MemberType,
  type UserStatus,
} from '~/domain/entities/event-user'
import type { EventUser } from '~/domain/entities/event-user'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const appStore = useAppStore()
const store = useUserStore()
const config = useRuntimeConfig()
const router = useRouter()

const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'categories', label: 'Master Kategori', icon: 'fa-solid fa-tags', to: '/dashboard/categories' },
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

const searchQuery = ref('')
const registrationRepository = new SupabaseRegistrationRepository()

// userId -> registration count (for the "Total Event" column).
// Hydrated in parallel after the user list arrives to avoid an extra
// Supabase round-trip.
const registrationCountByUser = ref<Record<string, number>>({})

// === Modal state ===
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingUser = ref<EventUser | null>(null)

/** User yang sedang dikonfirmasi untuk dihapus (null = tidak ada) */
const confirmDeleteUser = ref<EventUser | null>(null)
const deleteError = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    store.setSearch(searchQuery.value)
    store.fetchUsers().then(() => hydrateCounts())
  }, 350)
}

function changePage(page: number): void {
  store.setPage(page)
  store.fetchUsers().then(() => hydrateCounts())
}

async function hydrateCounts(): Promise<void> {
  // Drop entries for users that are no longer on the current page.
  const ids = store.users.map((u) => u.id)
  for (const key of Object.keys(registrationCountByUser.value)) {
    if (!ids.includes(key)) {
      delete registrationCountByUser.value[key]
    }
  }
  await Promise.all(
    ids.map(async (id) => {
      if (typeof registrationCountByUser.value[id] === 'number') return
      const list = await registrationRepository.getAll({ userId: id })
      registrationCountByUser.value[id] = list.length
    }),
  )
}

function goToDetail(userId: string): void {
  router.push(`/dashboard/users/${userId}`)
}

// === Badge styling ===
const USER_STATUS_STYLES: Record<UserStatus, { badge: string; dot: string }> = {
  active: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  inactive: { badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  banned: { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
}

const MEMBER_TYPE_STYLES: Record<MemberType, { badge: string; dot: string }> = {
  internal: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  external: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
}

function statusStyle(s: UserStatus): { badge: string; dot: string } {
  return USER_STATUS_STYLES[s] ?? USER_STATUS_STYLES.active
}
function memberStyle(s: MemberType): { badge: string; dot: string } {
  return MEMBER_TYPE_STYLES[s] ?? MEMBER_TYPE_STYLES.internal
}

// === Action handlers ===
function openAddModal(): void {
  showAddModal.value = true
}
function openEditModal(user: EventUser): void {
  editingUser.value = user
  showEditModal.value = true
}
function askDelete(user: EventUser): void {
  confirmDeleteUser.value = user
  deleteError.value = null
}
function cancelDelete(): void {
  confirmDeleteUser.value = null
  deleteError.value = null
}
async function confirmDelete(): Promise<void> {
  if (!confirmDeleteUser.value) return
  const result = await store.deleteUser(confirmDeleteUser.value.id)
  if (!result.success) {
    deleteError.value = result.error ?? 'Gagal menghapus user.'
    return
  }
  // Auto-refresh handled by store.deleteUser (calls fetchUsers).
  // Also drop the local count cache so it isn't stale.
  const id = confirmDeleteUser.value.id
  delete registrationCountByUser.value[id]
  confirmDeleteUser.value = null
}

/**
 * Handler untuk event `created` dari <DashboardAddUserModal>.
 * Store sudah memanggil `fetchUsers` di dalam `addUser`,
 * jadi kita tinggal re-hydrate count untuk baris baru.
 */
async function onCreated(userId: string): Promise<void> {
  showAddModal.value = false
  await hydrateCounts()
  // Opsional: scroll / highlight baris baru. Untuk sekarang
  // cukup biarkan list di-sort ulang oleh store.
  void userId
}

/**
 * Handler untuk event `updated` dari <DashboardEditUserModal>.
 * Store sudah memanggil `fetchUsers` di dalam `updateUser`.
 */
async function onUpdated(userId: string): Promise<void> {
  showEditModal.value = false
  editingUser.value = null
  await hydrateCounts()
  void userId
}

function formatCreated(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function initialsOf(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColor(seed: string): string {
  const colors = [
    'bg-emerald-100 text-emerald-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length] ?? colors[0]!
}

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  await store.fetchUsers()
  await hydrateCounts()
})
</script>

<template>
  <DashboardShell :items="NAV_ITEMS" section-label="Panel Operasional">
    <section class="space-y-5">
      <!-- ============ Page Header ============ -->
      <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
            <h2 class="font-extrabold text-xl sm:text-2xl text-emerald-700">Master User</h2>
          </div>
          <p class="text-sm sm:text-xs text-slate-500">
            Daftar seluruh user yang pernah mendaftar di event
            {{ config.public.companyName }}. Klik kartu untuk melihat
            event yang pernah diikuti.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-700 font-bold">
            <i class="fa-solid fa-shield-halved" />
            <span>Mode Admin — no HP tidak di-mask</span>
          </div>
          <button
            type="button"
            class="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-extrabold shadow-sm transition-all"
            @click="openAddModal"
          >
            <i class="fa-solid fa-user-plus" />
            <span>Tambah User</span>
          </button>
        </div>
      </header>

      <!-- ============ Toolbar: Search + Counter ============
           Search bar dibuat lebih besar di mobile (h-12, text 15px)
           supaya mudah dipakai pengguna lanjut usia. -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="relative flex-grow">
            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari nama atau nomor HP…"
              class="w-full min-h-[48px] pl-11 pr-4 py-2.5 text-[15px] sm:text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
              @input="onSearchInput"
            >
          </div>
          <div class="text-sm sm:text-xs text-slate-500 sm:text-right px-1">
            Total
            <span class="text-emerald-700 font-extrabold text-base sm:text-sm">{{ store.totalUsers }}</span>
            user terdaftar
          </div>
        </div>
      </div>

      <!-- ============ Master User Table ============ -->
      <DashboardUsersTableSkeleton v-if="store.isLoadingList" :rows="store.perPage" />

      <div
        v-else-if="store.listError"
        class="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700"
      >
        <i class="fa-solid fa-triangle-exclamation mr-2" />
        {{ store.listError }}
      </div>

      <div
        v-else-if="store.users.length === 0"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-slate-500"
      >
        <i class="fa-solid fa-users text-3xl text-slate-300 mb-2" />
        <p class="text-sm font-semibold">
          {{
            store.search
              ? `Tidak ada user yang cocok dengan "${store.search}".`
              : 'Belum ada user yang terdaftar.'
          }}
        </p>
      </div>

      <div
        v-else
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <!-- Header row (desktop only) -->
        <div class="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
          <div class="col-span-3">User</div>
          <div class="col-span-2">No HP</div>
          <div class="col-span-2 text-center">Status / Tipe</div>
          <div class="col-span-1 text-center">Event</div>
          <div class="col-span-2">Terdaftar</div>
          <div class="col-span-2 text-right">Aksi</div>
        </div>

        <!-- Rows (desktop) -->
        <div class="hidden md:block divide-y divide-slate-100">
          <div
            v-for="user in store.users"
            :key="user.id"
            class="w-full px-5 py-3 grid grid-cols-12 gap-3 items-center hover:bg-emerald-50/40 transition-colors"
          >
            <!-- User: avatar + name + id -->
            <button
              type="button"
              class="col-span-3 flex items-center gap-3 min-w-0 text-left"
              @click="goToDetail(user.id)"
            >
              <div
                :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0',
                  avatarColor(user.id),
                ]"
              >
                {{ initialsOf(user.nama) }}
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-slate-900 text-sm truncate">
                  {{ user.nama }}
                </h3>
                <p class="text-[10px] text-slate-400 font-mono mt-0.5">
                  {{ user.id }}
                </p>
              </div>
            </button>
            <!-- Phone (unmasked for admin) -->
            <button
              type="button"
              class="col-span-2 min-w-0 text-left"
              @click="goToDetail(user.id)"
            >
              <p class="text-xs text-slate-700 font-mono truncate flex items-center gap-1.5">
                <i class="fa-brands fa-whatsapp text-emerald-500 shrink-0" />
                <span class="truncate">{{ user.noHp }}</span>
              </p>
            </button>
            <!-- Status & Member type badges -->
            <button
              type="button"
              class="col-span-2 flex justify-center items-center gap-1.5 flex-wrap"
              @click="goToDetail(user.id)"
            >
              <span
                :class="[
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border',
                  statusStyle(user.userStatus).badge,
                ]"
              >
                <span :class="['w-1.5 h-1.5 rounded-full', statusStyle(user.userStatus).dot]" />
                {{ USER_STATUS_LABELS[user.userStatus] }}
              </span>
              <span
                :class="[
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border',
                  memberStyle(user.memberType).badge,
                ]"
              >
                <span :class="['w-1.5 h-1.5 rounded-full', memberStyle(user.memberType).dot]" />
                {{ MEMBER_TYPE_LABELS[user.memberType] }}
              </span>
            </button>
            <!-- Event count -->
            <button
              type="button"
              class="col-span-1 flex justify-center"
              @click="goToDetail(user.id)"
            >
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-100">
                <i class="fa-solid fa-calendar-check text-[10px]" />
                {{ registrationCountByUser[user.id] ?? '…' }}
              </span>
            </button>
            <!-- Registered date -->
            <button
              type="button"
              class="col-span-2 text-xs text-slate-700 text-left"
              @click="goToDetail(user.id)"
            >
              {{ formatCreated(user.createdAt) }}
            </button>
            <!-- Action buttons -->
            <div class="col-span-2 flex items-center justify-end gap-1.5">
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[11px] font-bold"
                title="Edit user"
                @click="openEditModal(user)"
              >
                <i class="fa-solid fa-pen" />
                <span class="hidden lg:inline">Edit</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-[11px] font-bold"
                title="Hapus user"
                @click="askDelete(user)"
              >
                <i class="fa-solid fa-trash" />
                <span class="hidden lg:inline">Hapus</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Rows (mobile).
             Dirancang untuk pengguna lanjut usia — avatar 64px,
             judul 16px, meta dalam kartu, tombol full-width 48px.
             Avatar di tap = buka detail user. -->
        <div class="md:hidden space-y-3 p-1">
          <div
            v-for="user in store.users"
            :key="`m-${user.id}`"
            class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            <div class="p-4 space-y-3">
              <!-- Header: avatar besar + nama + counter event -->
              <div class="flex gap-4">
                <button
                  type="button"
                  class="w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-lg shrink-0 ring-2 ring-white shadow-sm active:scale-95 transition-transform"
                  :class="avatarColor(user.id)"
                  @click="goToDetail(user.id)"
                >
                  {{ initialsOf(user.nama) }}
                </button>
                <div class="flex-1 min-w-0">
                  <button
                    type="button"
                    class="w-full text-left"
                    @click="goToDetail(user.id)"
                  >
                    <h3 class="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                      {{ user.nama }}
                    </h3>
                  </button>
                  <div class="mt-1.5">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200">
                      <i class="fa-solid fa-calendar-check" aria-hidden="true" />
                      {{ registrationCountByUser[user.id] ?? '…' }}
                      <span class="text-indigo-500 font-bold">event</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Meta dalam kartu agar tidak tercerai-berai -->
              <div class="bg-slate-50 rounded-xl p-3 space-y-2 text-sm text-slate-700">
                <div class="flex items-center gap-2">
                  <i class="fa-brands fa-whatsapp text-emerald-500 w-4 text-center shrink-0" aria-hidden="true" />
                  <span class="font-mono truncate">{{ user.noHp }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fa-regular fa-calendar text-slate-500 w-4 text-center shrink-0" aria-hidden="true" />
                  <span>Terdaftar {{ formatCreated(user.createdAt) }}</span>
                </div>
              </div>

              <!-- Status & tipe user -->
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
                    statusStyle(user.userStatus).badge,
                  ]"
                >
                  <span :class="['w-2 h-2 rounded-full', statusStyle(user.userStatus).dot]" />
                  {{ USER_STATUS_LABELS[user.userStatus] }}
                </span>
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
                    memberStyle(user.memberType).badge,
                  ]"
                >
                  <span :class="['w-2 h-2 rounded-full', memberStyle(user.memberType).dot]" />
                  {{ MEMBER_TYPE_LABELS[user.memberType] }}
                </span>
              </div>

              <!-- Tombol Detail: full-width sebagai primary action -->
              <button
                type="button"
                class="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] active:bg-slate-50 transition-all"
                @click="goToDetail(user.id)"
              >
                <i class="fa-solid fa-id-card" />
                <span>Lihat Detail & Riwayat</span>
              </button>
            </div>

            <!-- Action row: 2 tombol berwarna, full-width 48px -->
            <div class="grid grid-cols-2 border-t-2 border-slate-100">
              <button
                type="button"
                class="h-12 px-3 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] active:bg-amber-50 transition-all border-r-2 border-slate-100"
                @click="openEditModal(user)"
              >
                <i class="fa-solid fa-pen" aria-hidden="true" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                class="h-12 px-3 text-rose-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] active:bg-rose-50 transition-all"
                @click="askDelete(user)"
              >
                <i class="fa-solid fa-trash" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ Pagination ============
           Tombol lebih besar di mobile (min-h-12) supaya
           nyaman untuk pengguna lanjut usia. -->
      <div
        v-if="!store.isLoadingList && store.totalPages > 1"
        class="flex items-center justify-center gap-3 pt-2"
      >
        <button
          :disabled="store.page <= 1"
          class="min-h-[48px] min-w-[48px] px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 active:scale-[0.98] transition-all"
          @click="changePage(store.page - 1)"
        >
          <i class="fa-solid fa-chevron-left text-xs" />
          <span class="hidden sm:inline">Sebelumnya</span>
        </button>
        <div class="text-sm font-semibold text-slate-600 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
          Halaman <span class="text-emerald-700 font-extrabold">{{ store.page }}</span>
          dari <span class="font-bold text-slate-800">{{ store.totalPages }}</span>
        </div>
        <button
          :disabled="store.page >= store.totalPages"
          class="min-h-[48px] min-w-[48px] px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 active:scale-[0.98] transition-all"
          @click="changePage(store.page + 1)"
        >
          <span class="hidden sm:inline">Berikutnya</span>
          <i class="fa-solid fa-chevron-right text-xs" />
        </button>
      </div>
    </section>

    <!-- ============ Add User Modal ============ -->
    <DashboardAddUserModal v-model="showAddModal" @created="onCreated" />

    <!-- ============ Edit User Modal ============ -->
    <DashboardEditUserModal
      v-model="showEditModal"
      :user="editingUser"
      @updated="onUpdated"
    />

    <!-- ============ Confirm Delete Modal ============ -->
    <UiAppModal
      :model-value="confirmDeleteUser !== null"
      title="Hapus User?"
      subtitle="Tindakan ini tidak dapat dibatalkan. Semua data kehadiran user di event juga akan terhapus."
      max-width="max-w-md"
      :loading="store.isSubmitting"
      @update:model-value="(v) => { if (!v) cancelDelete() }"
    >
      <div class="p-6 space-y-3">
        <div class="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
          <div
            v-if="confirmDeleteUser"
            :class="[
              'w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0',
              avatarColor(confirmDeleteUser.id),
            ]"
          >
            {{ initialsOf(confirmDeleteUser.nama) }}
          </div>
          <div class="min-w-0 flex-grow">
            <p class="font-bold text-slate-900 text-sm truncate">
              {{ confirmDeleteUser?.nama }}
            </p>
            <p class="text-[10px] text-slate-500 font-mono mt-0.5">
              {{ confirmDeleteUser?.id }} · {{ confirmDeleteUser?.noHp }}
            </p>
          </div>
        </div>
        <p class="text-xs text-slate-600">
          Yakin ingin menghapus user ini dari Master User? Semua
          registrasi event yang terkait akan ikut terhapus
          (cascade delete).
        </p>
        <div
          v-if="deleteError"
          class="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl"
        >
          <i class="fa-solid fa-circle-exclamation" /> {{ deleteError }}
        </div>
      </div>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <UiAppButton
            variant="secondary"
            :disabled="store.isSubmitting"
            @click="cancelDelete"
          >
            <i class="fa-solid fa-xmark" /> Batal
          </UiAppButton>
          <UiAppButton
            variant="primary"
            class="!bg-rose-600 hover:!bg-rose-700 !text-white"
            :disabled="store.isSubmitting"
            @click="confirmDelete"
          >
            <i class="fa-solid fa-trash" />
            {{ store.isSubmitting ? 'Menghapus...' : 'Ya, Hapus' }}
          </UiAppButton>
        </div>
      </template>
    </UiAppModal>
  </DashboardShell>
</template>
