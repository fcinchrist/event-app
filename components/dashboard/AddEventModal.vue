<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useEventCategoryStore } from '~/presentation/stores/event-category'
import { useImageCompressor } from '~/presentation/composables/useImageCompressor'
import type { EventFormData } from '~/domain/entities/event'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [eventId: string]
  success: [message: string]
}>()

const store = useDashboardStore()
const categoryStore = useEventCategoryStore()
const { compressToWebP, allowedInputMimeTypes } = useImageCompressor()

// Derive the `accept` attribute for <input type="file"> from the
// composable's MIME allowlist (single source of truth: utils/file-validation.ts).
// e.g. "image/jpeg,image/png,image/gif,image/webp"
const acceptImageTypes = allowedInputMimeTypes.join(',')

interface FormState {
  title: string
  date: string
  quota: number
  location: string
  image: string
  description: string
  categoryId: string
}

function emptyForm(): FormState {
  return {
    title: '',
    date: '',
    quota: 50,
    location: '',
    image: '',
    description: '',
    categoryId: '',
  }
}

const form = ref<FormState>(emptyForm())
const localError = ref<string | null>(null)
const isUploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const canSubmit = computed(() => {
  return form.value.title.trim().length > 0
    && form.value.date.length > 0
    && form.value.location.trim().length > 0
    && form.value.quota > 0
})

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = emptyForm()
    localError.value = null
    // Lazy-load categories the first time the modal opens. The
    // store's `fetchCategories` is a no-op if it has been called
    // before, so it is safe to call on every open.
    void categoryStore.fetchCategories()
  }
})

async function onFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  isUploading.value = true
  try {
    const compressed = await compressToWebP(file)
    const result = await store.uploadImage(compressed)
    if (!result.success || !result.url) {
      localError.value = result.error ?? 'Gagal mengupload gambar.'
    } else {
      form.value.image = result.url
    }
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Gagal memproses gambar.'
  } finally {
    isUploading.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) {
    localError.value = 'Mohon lengkapi judul, tanggal, lokasi, dan kuota.'
    return
  }
  localError.value = null
  const payload: EventFormData = {
    title: form.value.title.trim(),
    date: form.value.date,
    quota: Number(form.value.quota),
    location: form.value.location.trim(),
    image: form.value.image,
    description: form.value.description,
    // Empty string means "no category" — normalize to `null` so the
    // repository writes SQL NULL on the FK column.
    categoryId: form.value.categoryId || null,
  }
  const result = await store.createEvent(payload)
  if (!result.success || !result.event) {
    localError.value = result.error ?? 'Gagal membuat event.'
    return
  }
  // Emit success event first so the parent page can show a global
  // toast/banner (see `pages/dashboard/events.vue`). We do this
  // BEFORE closing the modal so the success notification is fired
  // with the still-open modal context (avoids race where the
  // parent's `created` handler also runs refetch).
  emit('success', `Event "${result.event.title}" berhasil dirilis.`)
  emit('created', result.event.id)
  emit('update:modelValue', false)
}
</script>

<template>
  <UiAppModal
    v-model="isOpen"
    title="Buat Event Komunitas Baru"
    subtitle="Lengkapi data berikut untuk merilis agenda baru."
    :loading="store.isSubmitting || isUploading"
  >
    <form class="p-6 space-y-4 max-h-[70vh] overflow-y-auto" @submit.prevent="onSubmit">
      <UiFormField
        v-model="form.title"
        label="Judul / Nama Event"
        placeholder="Contoh: Friendship Gathering & BBQ"
        required
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UiFormField
          v-model="form.date"
          label="Tanggal & Waktu"
          type="datetime-local"
          required
        />
        <UiFormField
          v-model="form.quota"
          label="Batas Kuota Peserta"
          type="number"
          placeholder="50"
          required
        />
      </div>

      <UiFormField
        v-model="form.location"
        label="Lokasi Kegiatan"
        placeholder="Contoh: Central Park / Ruang Aula Lantai 2"
        required
      />

      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Kategori Kegiatan
          <span class="text-slate-400 normal-case font-normal">(opsional)</span>
        </label>
        <select
          v-model="form.categoryId"
          class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">— Tanpa kategori —</option>
          <option
            v-for="cat in categoryStore.categories"
            :key="cat.id"
            :value="cat.id"
          >
            {{ cat.name }}
          </option>
        </select>
        <p class="text-[11px] text-slate-400 mt-1">
          Kelola kategori di halaman Master Kategori pada menu sidebar.
        </p>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Cover / Poster Event
        </label>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            ref="fileInputRef"
            type="file"
            :accept="acceptImageTypes"
            class="text-xs text-slate-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            :disabled="isUploading"
            @change="onFileChange"
          >
          <div v-if="isUploading" class="text-xs text-slate-400">
            <i class="fa-solid fa-spinner fa-spin" /> Mengompres & mengupload...
          </div>
          <div v-else-if="form.image" class="text-xs text-emerald-600 truncate max-w-full">
            <i class="fa-solid fa-circle-check" /> Gambar terpasang
          </div>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">
          Format: JPG, PNG, GIF, atau WebP (maks. 5MB). Otomatis dikompres dan
          dikonversi ke WebP. SVG tidak didukung. (Pengguna iPhone: pilih
          &ldquo;Most Compatible&rdquo; di Settings &rarr; Camera &rarr; Formats.)
          Kosongkan jika ingin poster default.
        </p>
      </div>

      <UiFormField
        v-model="form.description"
        label="Deskripsi Singkat"
        placeholder="Opsional, jelaskan agenda & target peserta..."
        :rows="3"
      />

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
          :disabled="store.isSubmitting || isUploading"
          @click="isOpen = false"
        >
          <i class="fa-solid fa-xmark" /> Batal
        </UiAppButton>
        <UiAppButton
          variant="primary"
          :disabled="!canSubmit || store.isSubmitting || isUploading"
          @click="onSubmit"
        >
          <i class="fa-solid fa-rocket" />
          {{ store.isSubmitting ? 'Menyimpan...' : 'Rilis Event' }}
        </UiAppButton>
      </div>
    </template>
  </UiAppModal>
</template>
