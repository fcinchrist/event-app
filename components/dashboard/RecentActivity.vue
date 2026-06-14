<script setup lang="ts">
export interface ActivityLog {
  id: string
  name: string
  eventTitle: string
  checkInTime: string
}

interface Props {
  logs: ActivityLog[]
}

const props = defineProps<Props>()
</script>

<template>
  <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <h3 class="font-bold text-slate-900 text-base flex items-center gap-2">
      <i class="fa-solid fa-bolt text-amber-500" />
      Aktivitas Check-In Real-time
    </h3>
    <p class="text-xs text-slate-500 mb-4">
      Umpan langsung kehadiran yang di-scan atau di-input manual oleh panitia.
    </p>

    <div class="divide-y divide-slate-100 max-h-[250px] overflow-y-auto pr-2">
      <template v-if="props.logs.length > 0">
        <div
          v-for="log in props.logs"
          :key="log.id"
          class="py-3 flex items-center justify-between text-xs gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="bg-emerald-50 text-emerald-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0">
              <i class="fa-solid fa-user-check" />
            </div>
            <div class="min-w-0">
              <p class="font-bold text-slate-900 truncate">{{ log.name }}</p>
              <p class="text-[10px] text-slate-500 truncate">
                Masuk ke: {{ log.eventTitle }}
              </p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="bg-slate-100 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-md">
              {{ log.checkInTime }}
            </span>
          </div>
        </div>
      </template>
      <div v-else class="py-6 text-center text-slate-400 text-xs">
        Belum ada aktivitas absensi. Silakan mulai scan tiket di tab Scanner.
      </div>
    </div>
  </div>
</template>
