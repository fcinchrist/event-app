<script setup lang="ts">
import { useUserStore } from '~/presentation/stores/user'
import { normalizePhone } from '~/application/use-cases/normalize-phone'
import type { MemberType, UserStatus } from '~/domain/entities/event-user'
import {
  MEMBER_TYPE_LABELS,
  USER_STATUS_LABELS,
} from '~/domain/entities/event-user'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [userId: string]
}>()

const store = useUserStore()

interface FormState {
  nama: string
  noHp: string
  userStatus: UserStatus
  memberType: MemberType
}

function emptyForm(): FormState {
  return {
    nama: '',
    noHp: '',
    // Default ke nilai yang konsisten dengan DEFAULT di migration 004
    // dan use-case RegisterUser. Alur publik diasumsikan user eksternal,
    // admin bisa override lewat dropdown sebelum submit.
    userStatus: 'active',
    memberType: 'external',
  }
}

const form = ref<FormState>(emptyForm())
const localError = ref<string | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const canSubmit = computed(() => {
  return form.value.nama.trim().length >= 2
    && normalizePhone(form.value.noHp) !== null
})

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = emptyForm()
    localError.value = null
  }
})

const USER_STATUS_OPTIONS: UserStatus[] = ['active', 'inactive', 'banned']
const MEMBER_TYPE_OPTIONS: MemberType[] = ['internal', 'external']

async function onSubmit(): Promise<void> {
  localError.value = null
  if (!canSubmit.value) {
    localError.value = 'Mohon lengkapi nama (min. 2 karakter) dan nomor HP yang valid.'
    return
  }
  const result = await store.addUser({
    nama: form.value.nama,
    noHp: form.value.noHp,
    userStatus: form.value.userStatus,
    memberType: form.value.memberType,
  })
  if (!result.success || !result.user) {
    localError.value = result.error ?? 'Gagal menambahkan user.'
    return
  }
  emit('created', result.user.id)
  emit('update:modelValue', false)
}
</script>

<template>
  <UiAppModal
    v-model="isOpen"
    title="Tambah Master User"
    subtitle="Buat user baru secara manual. Status default: Aktif / Internal."
    max-width="max-w-lg"
    :loading="store.isSubmitting"
  >
    <form class="p-6 space-y-4" @submit.prevent="onSubmit">
      <UiFormField
        v-model="form.nama"
        label="Nama Lengkap"
        placeholder="Contoh: Budi Santoso"
        required
      />

      <UiFormField
        v-model="form.noHp"
        label="Nomor HP / WhatsApp"
        type="tel"
        digits-only
        placeholder="081234567890"
        hint="Hanya angka 0–9. Akan dinormalisasi ke format 08… otomatis."
        required
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Status Akun
          </label>
          <select
            v-model="form.userStatus"
            class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option
              v-for="opt in USER_STATUS_OPTIONS"
              :key="opt"
              :value="opt"
            >
              {{ USER_STATUS_LABELS[opt] }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Tipe Keanggotaan
          </label>
          <select
            v-model="form.memberType"
            class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option
              v-for="opt in MEMBER_TYPE_OPTIONS"
              :key="opt"
              :value="opt"
            >
              {{ MEMBER_TYPE_LABELS[opt] }}
            </option>
          </select>
        </div>
      </div>

      <div
        v-if="localError"
        class="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl"
      >
        <i class="fa-solid fa-circle-exclamation" /> {{ localError }}
      </div>
    </form>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <UiAppButton
          variant="secondary"
          :disabled="store.isSubmitting"
          @click="isOpen = false"
        >
          <i class="fa-solid fa-xmark" /> Batal
        </UiAppButton>
        <UiAppButton
          variant="primary"
          :disabled="!canSubmit || store.isSubmitting"
          @click="onSubmit"
        >
          <i class="fa-solid fa-user-plus" />
          {{ store.isSubmitting ? 'Menyimpan...' : 'Tambah User' }}
        </UiAppButton>
      </div>
    </template>
  </UiAppModal>
</template>
