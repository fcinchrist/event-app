<script setup lang="ts">
interface Props {
  modelValue: boolean
  title: string
  subtitle?: string
  maxWidth?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  maxWidth: 'max-w-lg',
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

function close(): void {
  if (props.loading) return
  emit('update:modelValue', false)
  emit('close')
}

function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) close()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <div
    v-if="props.modelValue"
    class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    @click="onBackdrop"
  >
    <div
      class="bg-white rounded-3xl w-full overflow-hidden shadow-2xl border border-slate-100"
      :class="props.maxWidth"
    >
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 class="font-extrabold text-slate-900 text-lg">{{ props.title }}</h3>
          <p v-if="props.subtitle" class="text-xs text-slate-400 mt-0.5">{{ props.subtitle }}</p>
        </div>
        <button
          class="text-slate-400 hover:text-rose-600 transition-colors"
          :disabled="props.loading"
          @click="close"
        >
          <i class="fa-solid fa-xmark text-lg" />
        </button>
      </div>

      <slot />

      <div v-if="$slots.footer" class="p-6 bg-slate-50 border-t border-slate-100">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
