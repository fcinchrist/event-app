<script setup lang="ts">
/**
 * AttendanceCountList
 * --------------------
 * Menampilkan ringkasan kehadiran per anggota dengan fitur sort.
 *
 * - Default sort: `totalHadir` DESC (sudah di-sort di repository).
 * - User bisa toggle sort:
 *     - `hadir_desc`  : paling banyak hadir di atas
 *     - `hadir_asc`   : paling sedikit hadir di atas
 *     - `name_asc`    : nama A-Z
 *     - `name_desc`   : nama Z-A
 *
 * Props:
 *   - `items`    : AttendanceSummary[] dari store
 *   - `isLoading`: skeleton flag
 *   - `periodLabel`: string label periode aktif (mis. "Semua Waktu",
 *     "Hari: 2026-06-16", "Tahun: 2026")
 */

import type { AttendanceSummary } from '~/domain/repositories/registration-repository'

type SortKey = 'hadir_desc' | 'hadir_asc' | 'name_asc' | 'name_desc'

interface Props {
  items: AttendanceSummary[]
  isLoading?: boolean
  periodLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  periodLabel: 'Semua Waktu',
})

const sortKey = ref<SortKey>('hadir_desc')

const sortedItems = computed<AttendanceSummary[]>(() => {
  const list = [...props.items]
  switch (sortKey.value) {
    case 'hadir_asc':
      return list.sort((a, b) => a.totalHadir - b.totalHadir || a.user.nama.localeCompare(b.user.nama, 'id'))
    case 'name_asc':
      return list.sort((a, b) => a.user.nama.localeCompare(b.user.nama, 'id'))
    case 'name_desc':
      return list.sort((a, b) => b.user.nama.localeCompare(a.user.nama, 'id'))
    case 'hadir_desc':
    default:
      return list.sort((a, b) => b.totalHadir - a.totalHadir || a.user.nama.localeCompare(b.user.nama, 'id'))
  }
})

function maskPhone(phone: string): string {
  if (!phone) return ''
  if (phone.length <= 6) return phone
  return phone.slice(0, 4) + '****' + phone.slice(-2)
}
</script>

<template>
  <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h3 class="font-bold text-slate-900 text-base flex items-center gap-2">
          <i class="fa-solid fa-people-group text-emerald-600" />
          Counting Kehadiran All Anggota
        </h3>
        <p class="text-xs text-slate-500">
          Total check-in (status <strong>Hadir</strong>) per anggota pada periode
          <strong>{{ props.periodLabel }}</strong>.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Urutkan
        </label>
        <select
          v-model="sortKey"
          class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="hadir_desc">Hadir Terbanyak</option>
          <option value="hadir_asc">Hadir Tersedikit</option>
          <option value="name_asc">Nama A → Z</option>
          <option value="name_desc">Nama Z → A</option>
        </select>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="props.isLoading" class="divide-y divide-slate-100">
      <div v-for="i in 5" :key="`att-skel-${i}`" class="py-3 flex items-center gap-3">
        <UiSkeletonBlock variant="circle" width="w-8" height="h-8" />
        <div class="flex-grow space-y-1.5 min-w-0">
          <UiSkeletonBlock variant="bar" width="w-1/3" height="h-3" />
          <UiSkeletonBlock variant="bar" width="w-1/4" height="h-2.5" />
        </div>
        <UiSkeletonBlock variant="bar" width="w-16" height="h-6" rounded="rounded-lg" />
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="sortedItems.length === 0"
      class="py-8 text-center text-xs text-slate-400 italic"
    >
      Belum ada data kehadiran pada periode ini.
    </div>

    <!-- List -->
    <div v-else class="divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-2">
      <div
        v-for="(item, idx) in sortedItems"
        :key="item.user.id"
        class="py-3 flex items-center gap-3"
      >
        <div class="bg-emerald-50 text-emerald-700 w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs">
          {{ idx + 1 }}
        </div>
        <div class="min-w-0 flex-grow">
          <p class="font-bold text-slate-900 truncate text-sm">
            {{ item.user.nama }}
          </p>
          <p class="text-[10px] text-slate-500 truncate font-mono">
            {{ maskPhone(item.user.noHp) }}
            <span v-if="item.totalRegistrasi > 0" class="ml-1">
              · {{ item.totalRegistrasi }}x registrasi
            </span>
          </p>
        </div>
        <div class="shrink-0 text-right">
          <div class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
            <i class="fa-solid fa-user-check text-[10px]" />
            <span class="font-extrabold text-sm">{{ item.totalHadir }}</span>
            <span class="text-[10px] font-semibold">Hadir</span>
          </div>
        </div>
      </div>
    </div>

    <div class="text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-3 mt-2">
      Sort default: jumlah kehadiran terbesar di atas. Klik dropdown untuk ubah.
    </div>
  </div>
</template>
