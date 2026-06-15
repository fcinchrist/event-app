<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'
import { useUserStore } from '~/presentation/stores/user'
import type { EventStatusValue } from '~/types/common'
import type { RegistrationStatus } from '~/domain/entities/registration'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const appStore = useAppStore()
const store = useUserStore()
const route = useRoute()
const config = useRuntimeConfig()

const NAV_ITEMS = [
  { key: 'ringkasan', label: 'Ringkasan Dashboard', icon: 'fa-solid fa-chart-line', to: '/dashboard' },
  { key: 'manage', label: 'Kelola Event', icon: 'fa-solid fa-list-check', to: '/dashboard/events' },
  { key: 'users', label: 'Master User', icon: 'fa-solid fa-users', to: '/dashboard/users' },
]

const userId = computed<string>(() => String(route.params.id ?? ''))

const STATUS_STYLES: Record<RegistrationStatus, { label: string; badge: string; dot: string }> = {
  Terdaftar: {
    label: 'Terdaftar',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  Hadir: {
    label: 'Hadir',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  'Tidak Hadir': {
    label: 'Tidak Hadir',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
}

const EVENT_STATUS_STYLES: Record<EventStatusValue, { badge: string; dot: string }> = {
  Aktif: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Dibatalkan: { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  Selesai: { badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
}

function statusStyle(s: RegistrationStatus): { label: string; badge: string; dot: string } {
  return STATUS_STYLES[s] ?? STATUS_STYLES.Terdaftar
}

function eventStatusStyle(s: EventStatusValue): { badge: string; dot: string } {
  return EVENT_STATUS_STYLES[s] ?? EVENT_STATUS_STYLES.Aktif
}

function formatDay(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  return `${formatDay(iso)} ${formatTime(iso)}`
}

function initialsOf(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0]?.[0] ?? '?') + (parts[parts.length - 1]?.[0] ?? '')
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

function openWhatsAppLink(phone: string): string {
  // Asumsi noHp sudah leading '0'. Untuk wa.me butuh '62…'.
  const trimmed = phone.replace(/\D/g, '')
  const international = trimmed.startsWith('0') ? `62${trimmed.slice(1)}` : trimmed
  return `https://wa.me/${international}`
}

const attendanceRate = computed<number>(() => {
  if (!store.selectedUserStats) return 0
  const { totalRegistered, totalAttended } = store.selectedUserStats
  if (totalRegistered <= 0) return 0
  return Math.round((totalAttended / totalRegistered) * 100)
})

onMounted(async () => {
  if (appStore.authUser === null) {
    await appStore.initAuth()
  }
  if (!userId.value) return
  await store.fetchUserDetail(userId.value)
})

onBeforeUnmount(() => {
  store.clearDetail()
})
</script>

<template>
  <DashboardShell :items="NAV_ITEMS" section-label="Panel Operasional">
    <section class="space-y-5">
      <!-- ============ Header + Back ============ -->
      <header class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <NuxtLink
            to="/dashboard/users"
            class="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 mb-2"
          >
            <i class="fa-solid fa-arrow-left text-[10px]" /> Kembali ke daftar user
          </NuxtLink>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-1.5 h-6 rounded-full bg-emerald-500" />
            <h2 class="font-extrabold text-2xl text-emerald-700">Detail User</h2>
          </div>
          <p class="text-xs text-slate-500">
            Profil lengkap & daftar event yang pernah diikuti di
            {{ config.public.companyName }}.
          </p>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-700 font-bold">
          <i class="fa-solid fa-shield-halved" />
          <span>Mode Admin — no HP tidak di-mask</span>
        </div>
      </header>

      <!-- ============ Loading / Error / Empty ============ -->
      <div
        v-if="store.isLoadingDetail"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
      >
        <div class="flex items-center gap-4">
          <UiSkeletonBlock variant="circle" width="w-16" height="h-16" />
          <div class="flex-grow space-y-2">
            <UiSkeletonBlock variant="bar" width="w-1/2" height="h-4" />
            <UiSkeletonBlock variant="bar" width="w-1/3" height="h-3" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <UiSkeletonBlock variant="block" width="w-full" height="h-20" rounded="rounded-xl" />
          <UiSkeletonBlock variant="block" width="w-full" height="h-20" rounded="rounded-xl" />
          <UiSkeletonBlock variant="block" width="w-full" height="h-20" rounded="rounded-xl" />
        </div>
        <UiSkeletonBlock variant="bar" width="w-full" height="h-32" rounded="rounded-xl" />
      </div>

      <div
        v-else-if="store.detailError"
        class="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700"
      >
        <i class="fa-solid fa-triangle-exclamation mr-2" />
        {{ store.detailError }}
      </div>

      <template v-else-if="store.selectedUser">
        <!-- ============ Profile Card ============ -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              :class="[
                'w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-xl shrink-0',
                avatarColor(store.selectedUser.id),
              ]"
            >
              {{ initialsOf(store.selectedUser.nama) }}
            </div>
            <div class="flex-grow min-w-0">
              <h3 class="text-xl font-extrabold text-slate-900 truncate">
                {{ store.selectedUser.nama }}
              </h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">
                {{ store.selectedUser.id }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono">
                  <i class="fa-brands fa-whatsapp text-emerald-500" />
                  <a
                    :href="openWhatsAppLink(store.selectedUser.noHp)"
                    target="_blank"
                    rel="noopener"
                    class="hover:underline"
                  >{{ store.selectedUser.noHp }}</a>
                </span>
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                  <i class="fa-regular fa-calendar text-slate-400" />
                  Terdaftar {{ formatDay(store.selectedUser.createdAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ KPI Cards ============ -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <i class="fa-solid fa-calendar-plus text-indigo-500" /> Total Daftar
            </p>
            <p class="text-2xl font-extrabold text-slate-900 mt-1">
              {{ store.selectedUserStats?.totalRegistered ?? 0 }}
            </p>
            <p class="text-[11px] text-slate-500 mt-0.5">event yang pernah diikuti</p>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <i class="fa-solid fa-circle-check text-emerald-500" /> Hadir
            </p>
            <p class="text-2xl font-extrabold text-emerald-700 mt-1">
              {{ store.selectedUserStats?.totalAttended ?? 0 }}
            </p>
            <p class="text-[11px] text-slate-500 mt-0.5">check-in sukses</p>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <i class="fa-solid fa-chart-pie text-amber-500" /> Tingkat Kehadiran
            </p>
            <div class="flex items-baseline gap-1 mt-1">
              <p class="text-2xl font-extrabold text-amber-600">{{ attendanceRate }}%</p>
              <p class="text-[11px] text-slate-500">dari total daftar</p>
            </div>
            <div class="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                :style="{ width: `${attendanceRate}%` }"
              />
            </div>
          </div>
        </div>

        <!-- ============ Daftar Event ============ -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-emerald-500" />
                Event yang Pernah Diikuti
              </h3>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Diurutkan dari event terbaru.
              </p>
            </div>
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {{ store.selectedUserRegistrations.length }} event
            </span>
          </div>

          <div
            v-if="store.selectedUserRegistrations.length === 0"
            class="p-10 text-center text-slate-500"
          >
            <i class="fa-solid fa-calendar-xmark text-3xl text-slate-300 mb-2" />
            <p class="text-sm font-semibold">User ini belum pernah mendaftar di event manapun.</p>
          </div>

          <div v-else class="divide-y divide-slate-100">
            <div
              v-for="reg in store.selectedUserRegistrations"
              :key="reg.id"
              class="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-emerald-50/30"
            >
              <div class="flex items-center gap-3 min-w-0 flex-grow">
                <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                  <i v-if="!reg.event.image" class="fa-solid fa-image text-slate-300" />
                  <img
                    v-else
                    :src="reg.event.image"
                    :alt="reg.event.title"
                    class="w-full h-full object-cover"
                  >
                </div>
                <div class="min-w-0 flex-grow">
                  <NuxtLink
                    :to="`/event/${reg.event.id}`"
                    class="font-bold text-slate-900 text-sm hover:text-emerald-700 line-clamp-1"
                  >{{ reg.event.title }}</NuxtLink>
                  <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span class="flex items-center gap-1">
                      <i class="fa-solid fa-calendar text-emerald-500 w-3 text-center" />
                      {{ formatDay(reg.event.date) }}
                    </span>
                    <span class="flex items-center gap-1">
                      <i class="fa-solid fa-location-dot text-rose-400 w-3 text-center" />
                      <span class="truncate max-w-[160px] inline-block align-bottom">{{ reg.event.location }}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  :class="[
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                    eventStatusStyle(reg.event.status).badge,
                  ]"
                >
                  <span :class="['w-1.5 h-1.5 rounded-full', eventStatusStyle(reg.event.status).dot]" />
                  {{ reg.event.status }}
                </span>
                <span
                  :class="[
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                    statusStyle(reg.status).badge,
                  ]"
                >
                  <span :class="['w-1.5 h-1.5 rounded-full', statusStyle(reg.status).dot]" />
                  {{ statusStyle(reg.status).label }}
                </span>
                <span class="text-[10px] text-slate-400 font-mono">
                  {{ formatDateTime(reg.registeredAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </DashboardShell>
</template>
