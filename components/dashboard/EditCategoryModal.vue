<script setup lang="ts">
import { useEventCategoryStore } from '~/presentation/stores/event-category'
import type { EventCategory } from '~/domain/entities/event-category'

interface Props {
  modelValue: boolean
  category: EventCategory | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: [categoryId: string]
}>()

const store = useEventCategoryStore()

interface FormState {
  name: string
  detail: string
}

function emptyForm(): FormState {
  return { name: '', detail: '' }
}

const form = ref<FormState>(emptyForm())
const localError = ref<string | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const canSubmit = computed(() => form.value.name.trim().length >= 2)

watch(
  () => [props.modelValue, props.category] as const,
  ([open, category]) => {
    if (open && category) {
      form.value = {
        name: category.name,
        detail: category.detail,
      }
      localError.value = null
    } else if (open && !category) {
      form.value = emptyForm()
      localError.value = null
    }
  },
)

async function onSubmit(): Promise<void> {
  if (!props.category) {
    localError.value = 'Category not found.'
    return
  }
  if (!canSubmit.value) {
    localError.value = 'Category name is required (min. 2 characters).'
    return
  }
  localError.value = null
  const result = await store.updateCategory(props.category.id, {
    name: form.value.name.trim(),
    detail: form.value.detail.trim(),
  })
  if (!result.success) {
    localError.value = result.error ?? 'Failed to update category.'
    return
  }
  emit('updated', props.category.id)
  emit('update:modelValue', false)
}
</script>

<template>
  <UiAppModal
    v-model="isOpen"
    title="Edit Master Category"
    subtitle="Update the category label or description. Name must be unique."
    :loading="store.isSubmitting"
  >
    <form class="p-6 space-y-4" @submit.prevent="onSubmit">
      <UiFormField
        v-model="form.name"
        label="Category Name"
        placeholder="e.g. Workshop"
        required
      />

      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Detail
        </label>
        <textarea
          v-model="form.detail"
          rows="3"
          placeholder="Short description shown on hover (optional)"
          class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
        />
      </div>

      <div v-if="localError" class="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-medium">
        {{ localError }}
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
          @click="isOpen = false"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="!canSubmit || store.isSubmitting"
          class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm shadow-emerald-100"
        >
          Save Changes
        </button>
      </div>
    </form>
  </UiAppModal>
</template>
