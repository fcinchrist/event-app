<script setup lang="ts">
import { useDashboardStore } from '~/presentation/stores/dashboard'
import { useImageCompressor } from '~/presentation/composables/useImageCompressor'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [eventId: string]
}>()

const store = useDashboardStore()
const { compressToWebP } = useImageCompressor()

interface FormState {
  title: string
  date: string
  quota: number
  location: string
  image: string
  description: string
}

const form = reactive<FormState>({
  title: '',
  date: '',
  quota: 50,
  location: '',
  image: '',
  description: '',
})

const previewUrl = ref<string>('')
const uploadError = ref<string>('')
const isUploading = ref(false)
const isCompressing = ref(false)
const originalSize = ref<number>(0)
const compressedSize = ref<number>(0)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

function resetForm(): void {
  form.title = ''
  form.date = ''
  form.quota = 50
  form.location = ''
  form.image = ''
  form.description = ''
  previewUrl.value = ''
  uploadError.value = ''
  originalSize.value = 0
  compressedSize.value = 0
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  },
)

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

async function onFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadError.value = ''
  isCompressing.value = true
  originalSize.value = file.size

  try {
    // 1) Compress ke WebP
    const compressed = await compressToWebP(file, { quality: 0.8, maxWidth: 1280, maxHeight: 1280 })
    compressedSize.value = compressed.size

    // 2) Preview lokal
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(compressed)

    // 3) Upload ke Supabase Storage
    isCompressing.value = false
    isUploading.value = true
    const result = await store.uploadImage(compressed)
    if (result.success && result.url) {
      form.image = result.url
    } else {
      uploadError.value = result.error ?? 'Gagal upload gambar.'
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memproses gambar.'
    uploadError.value = message
  } finally {
    isUploading.value = false
    isCompressing.value = false
  }
}

function removeImage(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  form.image = ''
  originalSize.value = 0
  compressedSize.value = 0
}

async function onSubmit(): Promise<void> {
  if (isUploading.value || isCompressing.value) return

  const result = await store.createEvent({
    title: form.title,
    date: form.date,
    quota: form.quota,
    location: form.location,
    image: form.image,
    description: form.description,
  })

  if (result.success && result.event) {
    emit('created', result.event.id)
    isOpen.value = false
  } else {
    alert(result.error ?? 'Gagal membuat event.')
  }
}
</script>

<template>
  <UiAppModal
    v-model="isOpen"
    title="Buat Event Komunitas Baru"
    subtitle="Lengkapi data berikut untuk merilis agenda baru. Cover bersifat opsional."
    max-width="max-w-2xl"
    :loading="store.isSubmitting"
  >
    <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <UiFormField
            v-model="form.title"
            label="Judul / Nama Event"
            placeholder="Contoh: Friendship Gathering & BBQ"
            required
          />
        </div>
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

      <UiFormField
        v-model="form.description"
        label="Deskripsi Ringkas Event"
        placeholder="Tuliskan agenda seru atau syarat kegiatan di sini..."
      />

      <!-- Image Upload (Opsional) -->
      <div>
        <div class="flex justify-between items-center mb-1">
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Cover / Poster Event
            <span class="text-slate-400 normal-case font-medium">(opsional)</span>
          </label>
        </div>

        <!-- Empty state: pakai <label> agar klik dropzone langsung trigger file picker native -->
        <label
          v-if="!previewUrl"
          for="event-cover-input"
          class="block border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 transition-colors cursor-pointer"
        >
          <i class="fa-solid fa-cloud-arrow-up text-2xl text-slate-400 mb-2" />
          <p class="text-xs text-slate-600 font-semibold">Klik untuk pilih gambar</p>
          <p class="text-[11px] text-slate-400 mt-1">
            Otomatis dikompres ke WebP untuk hemat storage. Boleh dikosongkan.
          </p>
          <input
            id="event-cover-input"
            type="file"
            accept="image/*"
            class="sr-only"
            @change="onFileChange"
          >
        </label>

        <!-- Preview + meta -->
        <div v-else class="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
          <img :src="previewUrl" alt="Preview" class="w-full h-48 object-cover">
          <button
            type="button"
            class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-rose-600 hover:bg-rose-50 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            :disabled="isUploading"
            @click="removeImage"
          >
            <i class="fa-solid fa-trash-can text-xs" />
          </button>

          <div v-if="isCompressing || isUploading" class="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div class="text-center">
              <i class="fa-solid fa-circle-notch fa-spin text-emerald-600 text-xl" />
              <p class="text-xs font-semibold text-slate-700 mt-2">
                {{ isCompressing ? 'Mengompres ke WebP...' : 'Mengupload ke Supabase...' }}
              </p>
            </div>
          </div>

          <div class="p-3 bg-white border-t border-slate-100 flex justify-between text-[11px]">
            <span class="text-slate-500">
              Asli: <strong class="text-slate-700">{{ formatBytes(originalSize) }}</strong>
            </span>
            <span class="text-emerald-600 font-bold">
              WebP: {{ formatBytes(compressedSize) }}
              <span v-if="originalSize > 0 && compressedSize > 0">
                ({{ Math.round((1 - compressedSize / originalSize) * 100) }}% lebih kecil)
              </span>
            </span>
          </div>

          <!-- Tombol ganti cover -->
          <label
            for="event-cover-input"
            class="block p-2 bg-slate-50 border-t border-slate-100 text-center text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            <i class="fa-solid fa-rotate" /> Ganti Cover
          </label>
          <input
            id="event-cover-input"
            type="file"
            accept="image/*"
            class="sr-only"
            @change="onFileChange"
          >
        </div>

        <p v-if="uploadError" class="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
          <i class="fa-solid fa-circle-exclamation" /> {{ uploadError }}
        </p>
        <p v-else-if="form.image && !isUploading" class="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
          <i class="fa-solid fa-circle-check" /> Gambar berhasil diupload
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-3">
        <UiAppButton variant="secondary" :disabled="store.isSubmitting" @click="isOpen = false">
          Batal
        </UiAppButton>
        <UiAppButton
          :loading="store.isSubmitting"
          :disabled="isUploading || isCompressing"
          @click="onSubmit"
        >
          <i class="fa-solid fa-floppy-disk" /> Simpan & Terbitkan
        </UiAppButton>
      </div>
    </template>
  </UiAppModal>
</template>
