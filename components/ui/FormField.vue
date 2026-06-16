<script setup lang="ts">
interface Props {
  label: string
  modelValue: string | number
  type?: 'text' | 'number' | 'datetime-local' | 'email' | 'url' | 'tel'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  rows?: number
  helper?: string
  /**
   * If `true`, the input only accepts digit characters (0–9).
   * Non-digit characters are automatically stripped on every
   * keystroke. Only effective for 'text' and 'tel' types; ignored
   * for other input types (number, date, etc.).
   */
  digitsOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  required: false,
  disabled: false,
  rows: 3,
  helper: '',
  digitsOnly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const isTextarea = computed(() => props.type === 'text' && props.rows > 1)

/**
 * When `digitsOnly` is active and the input type is 'text' or
 * 'tel', strip every non-digit character from the emitted value.
 * We mutate the DOM input directly (`target.value`) so the cursor
 * does not jump and the visible value stays consistent with state.
 */
function onInput(e: Event): void {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement
  if (props.type === 'number') {
    emit('update:modelValue', Number(target.value))
    return
  }
  let value = target.value
  if (props.digitsOnly && (props.type === 'text' || props.type === 'tel')) {
    const stripped = value.replace(/\D/g, '')
    if (stripped !== value) {
      target.value = stripped
    }
    value = stripped
  }
  emit('update:modelValue', value)
}
</script>

<template>
  <div>
    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
      {{ props.label }}
      <span v-if="props.required" class="text-rose-500">*</span>
    </label>

    <textarea
      v-if="isTextarea"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :rows="props.rows"
      :required="props.required"
      class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
      @input="onInput"
    />

    <input
      v-else
      :value="props.modelValue"
      :type="props.type"
      :inputmode="props.digitsOnly ? 'numeric' : undefined"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :required="props.required"
      class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
      @input="onInput"
    >

    <p v-if="props.helper" class="text-[11px] text-slate-400 mt-1">{{ props.helper }}</p>
  </div>
</template>
