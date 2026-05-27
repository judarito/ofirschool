<template>
  <div class="card table-card">
    <table class="table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td v-for="column in columns" :key="column.key">
            <slot :name="column.key" :row="row">
              {{ row[column.key] }}
            </slot>
          </td>
          <td class="actions-cell">
            <button class="table-action" type="button" @click="$emit('edit', row)">Editar</button>
            <button class="table-action danger" type="button" @click="$emit('delete', row)">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts" generic="T extends { id: string; [key: string]: unknown }">
defineProps<{
  columns: { key: string; label: string }[]
  rows: T[]
}>()

defineEmits<{
  edit: [row: T]
  delete: [row: T]
}>()
</script>
