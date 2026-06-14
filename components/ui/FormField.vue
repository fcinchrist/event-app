<script setup lang="ts">
interface Props {
  label: string
  modelValue: string | number
  type?: 'text' | 'number' | 'datetime-local' | 'email' | 'url'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  rows?: number
  helper?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  required: false,
  disabled: false,
  rows: 3,
  helper: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const isTextarea = computed(() => props.type === 'text' && props.rows > 1)

function onInput(e: Event): void {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement
  const value = props.type === 'number' ? Number(target.value) : target.value
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
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :required="props.required"
      class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
      @input="onInput"
    >

    <p v-if="props.helper" class="text-[11px] text-slate-400 mt-1">{{ props.helper }}</p>
  </div>
</template>
