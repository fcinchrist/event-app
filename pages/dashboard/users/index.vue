<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useUserStore } from '~/presentation/stores/user'
import { SupabaseRegistrationRepository } from '~/infrastructure/repositories/supabase-registration-repository'

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
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

const searchQuery = ref('')
const registrationRepository = new SupabaseRegistrationRepository()

// userId -> registration count (for the "Total Event" column).
// Hydrated in parallel after the user list arrives to avoid an extra
// Supabase round-trip.
const registrationCountByUser = ref<Record<string, number>>({})

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
            <h2 class="font-extrabold text-2xl text-emerald-700">Master User</h2>
          </div>
          <p class="text-xs text-slate-500">
            Daftar seluruh user yang pernah mendaftar di event
            {{ config.public.companyName }}. Klik kartu untuk melihat
            event yang pernah diikuti.
          </p>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-700 font-bold">
          <i class="fa-solid fa-shield-halved" />
          <span>Mode Admin — no HP tidak di-mask</span>
        </div>
      </header>

      <!-- ============ Toolbar: Search + Counter ============ -->
      <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="relative flex-grow">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari nama atau nomor HP…"
              class="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
              @input="onSearchInput"
            >
          </div>
          <div class="text-xs text-slate-500 sm:text-right">
            Total
            <span class="text-emerald-700 font-extrabold">{{ store.totalUsers }}</span>
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
          <div class="col-span-4">User</div>
          <div class="col-span-3">No HP</div>
          <div class="col-span-2 text-center">Total Event</div>
          <div class="col-span-2">Terdaftar</div>
          <div class="col-span-1 text-right">Aksi</div>
        </div>

        <!-- Rows (desktop) -->
        <div class="hidden md:block divide-y divide-slate-100">
          <button
            v-for="user in store.users"
            :key="user.id"
            type="button"
            class="w-full text-left px-5 py-3 grid grid-cols-12 gap-3 items-center hover:bg-emerald-50/40 transition-colors"
            @click="goToDetail(user.id)"
          >
            <!-- User: avatar + name + id -->
            <div class="col-span-4 flex items-center gap-3 min-w-0">
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
            </div>
            <!-- Phone (unmasked for admin) -->
            <div class="col-span-3 min-w-0">
              <p class="text-xs text-slate-700 font-mono truncate flex items-center gap-1.5">
                <i class="fa-brands fa-whatsapp text-emerald-500 shrink-0" />
                <span class="truncate">{{ user.noHp }}</span>
              </p>
            </div>
            <!-- Event count -->
            <div class="col-span-2 flex justify-center">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-100">
                <i class="fa-solid fa-calendar-check text-[10px]" />
                {{ registrationCountByUser[user.id] ?? '…' }}
              </span>
            </div>
            <!-- Registered date -->
            <div class="col-span-2 text-xs text-slate-700">
              {{ formatCreated(user.createdAt) }}
            </div>
            <!-- Action -->
            <div class="col-span-1 flex items-center justify-end">
              <span class="text-[10px] font-extrabold text-emerald-700 inline-flex items-center gap-1">
                Detail <i class="fa-solid fa-arrow-right text-[9px]" />
              </span>
            </div>
          </button>
        </div>

        <!-- Rows (mobile) -->
        <div class="md:hidden divide-y divide-slate-100">
          <button
            v-for="user in store.users"
            :key="`m-${user.id}`"
            type="button"
            class="w-full text-left p-4 flex gap-3 hover:bg-emerald-50/40"
            @click="goToDetail(user.id)"
          >
            <div
              :class="[
                'w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0',
                avatarColor(user.id),
              ]"
            >
              {{ initialsOf(user.nama) }}
            </div>
            <div class="flex-grow min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-bold text-slate-900 text-sm leading-snug truncate min-w-0">
                  {{ user.nama }}
                </h3>
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-100 shrink-0">
                  <i class="fa-solid fa-calendar-check text-[9px]" />
                  {{ registrationCountByUser[user.id] ?? '…' }}
                </span>
              </div>
              <div class="mt-1 space-y-0.5 text-[11px] text-slate-500">
                <p class="font-mono truncate flex items-center gap-1.5">
                  <i class="fa-brands fa-whatsapp text-emerald-500" />
                  {{ user.noHp }}
                </p>
                <p class="flex items-center gap-1.5">
                  <i class="fa-regular fa-calendar text-slate-400" />
                  {{ formatCreated(user.createdAt) }}
                </p>
              </div>
              <p class="mt-2 text-[10px] font-extrabold text-emerald-700 inline-flex items-center gap-1">
                Lihat detail <i class="fa-solid fa-arrow-right text-[9px]" />
              </p>
            </div>
          </button>
        </div>
      </div>

      <!-- ============ Pagination ============ -->
      <div
        v-if="!store.isLoadingList && store.totalPages > 1"
        class="flex items-center justify-center gap-2 pt-2"
      >
        <button
          :disabled="store.page <= 1"
          class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          @click="changePage(store.page - 1)"
        >
          <i class="fa-solid fa-chevron-left text-xs" />
        </button>
        <div class="text-xs font-semibold text-slate-600 px-3">
          Halaman <span class="text-emerald-700 font-extrabold">{{ store.page }}</span>
          dari <span>{{ store.totalPages }}</span>
        </div>
        <button
          :disabled="store.page >= store.totalPages"
          class="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          @click="changePage(store.page + 1)"
        >
          <i class="fa-solid fa-chevron-right text-xs" />
        </button>
      </div>
    </section>
  </DashboardShell>
</template>
