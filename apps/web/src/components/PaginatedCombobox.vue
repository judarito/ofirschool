<template>
  <div ref="rootRef" class="paginated-combobox">
    <button
      class="paginated-combobox__trigger"
      type="button"
      :disabled="disabled"
      :aria-expanded="isOpen"
      @click="toggleOpen"
    >
      <span :class="{ 'paginated-combobox__placeholder': !selectedLabel }">
        {{ selectedLabel || placeholder }}
      </span>
      <span class="paginated-combobox__chevron" aria-hidden="true">⌄</span>
    </button>

    <div v-if="isOpen" class="paginated-combobox__panel">
      <input
        class="paginated-combobox__search"
        :value="search"
        :placeholder="searchPlaceholder"
        @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
        @keydown.esc="isOpen = false"
      />

      <div class="paginated-combobox__results">
        <button
          v-for="item in items"
          :key="getItemKey(item)"
          class="paginated-combobox__option"
          :class="{ 'paginated-combobox__option--active': getItemKey(item) === modelValue }"
          type="button"
          @click="selectItem(item)"
        >
          <slot name="option" :item="item">
            {{ getItemLabel(item) }}
          </slot>
        </button>
        <p v-if="!items.length" class="paginated-combobox__empty">{{ noResultsText }}</p>
      </div>

      <div class="paginated-combobox__footer">
        <small>{{ total ? `${startItem}-${endItem} de ${total}` : 'Sin resultados' }}</small>
        <div>
          <button class="button button--ghost" type="button" :disabled="page <= 1" @click="$emit('page-change', page - 1)">Anterior</button>
          <button class="button button--ghost" type="button" :disabled="page >= totalPages" @click="$emit('page-change', page + 1)">Siguiente</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  selectedLabel?: string
  placeholder?: string
  search: string
  searchPlaceholder?: string
  items: unknown[]
  total: number
  page: number
  pageSize: number
  disabled?: boolean
  noResultsText?: string
  getItemKey: (item: unknown) => string
  getItemLabel: (item: unknown) => string
}>(), {
  selectedLabel: '',
  placeholder: 'Selecciona una opción',
  searchPlaceholder: 'Buscar...',
  disabled: false,
  noResultsText: 'No hay resultados.',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:search': [value: string]
  'page-change': [page: number]
  select: [item: unknown]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const totalPages = computed(() => Math.max(Math.ceil(props.total / props.pageSize), 1))
const startItem = computed(() => (props.items.length ? (props.page - 1) * props.pageSize + 1 : 0))
const endItem = computed(() => Math.min(props.page * props.pageSize, props.total))

const toggleOpen = () => {
  if (!props.disabled) isOpen.value = !isOpen.value
}

const selectItem = (item: unknown) => {
  emit('update:modelValue', props.getItemKey(item))
  emit('select', item)
  isOpen.value = false
}

const handleDocumentClick = (event: MouseEvent) => {
  if (!rootRef.value?.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<style scoped>
.paginated-combobox {
  position: relative;
}

.paginated-combobox__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 42px;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.65rem;
  background: var(--surface);
  color: var(--text);
  text-align: left;
}

.paginated-combobox__placeholder,
.paginated-combobox__chevron {
  color: var(--text-muted);
}

.paginated-combobox__panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + 0.4rem);
  left: 0;
  right: 0;
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
  box-shadow: var(--shadow-xl);
}

.paginated-combobox__search {
  width: 100%;
}

.paginated-combobox__results {
  display: grid;
  gap: 0.45rem;
  max-height: 280px;
  overflow-y: auto;
}

.paginated-combobox__option {
  display: block;
  width: 100%;
  padding: 0.65rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 0.55rem;
  background: var(--surface);
  color: var(--text);
  text-align: left;
}

.paginated-combobox__option--active {
  border-color: color-mix(in srgb, var(--brand-primary) 42%, var(--border));
  background: var(--brand-primary-soft);
}

.paginated-combobox__empty {
  margin: 0;
  color: var(--text-muted);
}

.paginated-combobox__footer,
.paginated-combobox__footer > div {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.paginated-combobox__footer {
  justify-content: space-between;
}

@media (max-width: 560px) {
  .paginated-combobox__panel {
    position: fixed;
    inset: auto 0 0;
    max-height: min(76vh, 520px);
    border-radius: 1rem 1rem 0 0;
  }

  .paginated-combobox__footer {
    display: grid;
  }

  .paginated-combobox__footer > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
</style>
