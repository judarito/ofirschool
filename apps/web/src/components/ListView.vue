<template>
  <SurfaceCard>
    <div class="list-view__header">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>

      <div class="list-view__toolbar">
        <SearchInput v-model="searchInput" :placeholder="searchPlaceholder" />
        <slot name="toolbar-actions">
          <button v-if="createLabel" class="button button--brand" type="button" @click="$emit('create')">
            {{ createLabel }}
          </button>
        </slot>
      </div>
    </div>

    <div v-if="loading" class="list-view__loading">Cargando registros...</div>

    <template v-else-if="items.length">
      <div class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
              <th v-if="showActions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="getRowId(row)">
              <td v-for="column in columns" :key="column.key">
                <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                  {{ row[column.key] }}
                </slot>
              </td>
              <td v-if="showActions" class="list-view__actions">
                <slot name="row-actions" :row="row">
                  <button class="table-action" type="button" @click="$emit('edit', row)">Editar</button>
                  <button class="table-action table-action--danger" type="button" @click="$emit('delete', row)">Eliminar</button>
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="list-view__cards">
        <article v-for="row in items" :key="`${getRowId(row)}-card`" class="list-view__card">
          <div class="list-view__card-main">
            <strong>{{ String(row[columns[0]?.key] ?? '') }}</strong>
            <span>{{ String(row[columns[1]?.key] ?? '') }}</span>
          </div>
          <div class="list-view__card-grid">
            <div v-for="column in columns.slice(2)" :key="column.key">
              <small>{{ column.label }}</small>
              <div>
                <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                  {{ row[column.key] }}
                </slot>
              </div>
            </div>
          </div>
          <div v-if="showActions" class="list-view__actions">
            <slot name="row-actions" :row="row">
              <button class="table-action" type="button" @click="$emit('edit', row)">Editar</button>
              <button class="table-action table-action--danger" type="button" @click="$emit('delete', row)">Eliminar</button>
            </slot>
          </div>
        </article>
      </div>

      <div class="list-view__footer">
        <p>Mostrando {{ startItem }}-{{ endItem }} de {{ total }} registros</p>
        <div class="list-view__pagination">
          <select v-model.number="pageSize">
            <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }} / pag.</option>
          </select>
          <div class="list-view__pagination-nav">
            <button class="chip-button" type="button" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">Anterior</button>
            <span class="list-view__page-status">Página {{ currentPage }} de {{ totalPages }}</span>
            <button class="chip-button" type="button" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">Siguiente</button>
          </div>
        </div>
      </div>
    </template>

    <EmptyState v-else :title="emptyTitle" :description="emptyDescription" />
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import EmptyState from './EmptyState.vue'
import SearchInput from './SearchInput.vue'
import SurfaceCard from './SurfaceCard.vue'

type Row = {
  id: string
} & Record<string, unknown>

const props = withDefaults(
  defineProps<{
    title: string
    subtitle: string
    columns: Array<{ key: string; label: string }>
    fetcher: (params: { page: number; pageSize: number; query: string }) => Promise<{
      items: Row[]
      total: number
      page: number
      pageSize: number
    }>
    searchPlaceholder?: string
    createLabel?: string
    emptyTitle?: string
    emptyDescription?: string
    initialPageSize?: number
    pageSizeOptions?: number[]
    showActions?: boolean
    reloadKey?: string | number
  }>(),
  {
    searchPlaceholder: 'Buscar...',
    createLabel: '',
    emptyTitle: 'Sin resultados',
    emptyDescription: 'No hay registros disponibles.',
    initialPageSize: 10,
    pageSizeOptions: () => [10, 20, 50],
    showActions: true,
  },
)

defineEmits<{
  create: []
  edit: [row: Row]
  delete: [row: Row]
}>()

const items = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(props.initialPageSize)
const query = ref('')
const searchInput = ref('')
let debounceHandle: ReturnType<typeof setTimeout> | null = null

const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize.value), 1))
const startItem = computed(() => (items.value.length ? (currentPage.value - 1) * pageSize.value + 1 : 0))
const endItem = computed(() => (items.value.length ? startItem.value + items.value.length - 1 : 0))

const load = async () => {
  loading.value = true
  try {
    const response = await props.fetcher({
      page: currentPage.value,
      pageSize: pageSize.value,
      query: query.value,
    })
    items.value = response.items
    total.value = response.total
    currentPage.value = response.page
    pageSize.value = response.pageSize
  } finally {
    loading.value = false
  }
}

const goToPage = (page: number) => {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
}

const getRowId = (row: Row) => String(row.id ?? crypto.randomUUID())

watch([currentPage, pageSize], () => {
  void load()
})

watch(searchInput, (value) => {
  if (debounceHandle) clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => {
    query.value = value
    currentPage.value = 1
    void load()
  }, 300)
})

watch(
  () => props.reloadKey,
  async () => {
    if (currentPage.value !== 1) {
      currentPage.value = 1
      return
    }

    await load()
  },
)

onMounted(async () => {
  await load()
})

defineExpose({
  reload: load,
})
</script>
