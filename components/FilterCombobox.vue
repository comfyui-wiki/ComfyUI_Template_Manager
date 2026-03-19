<template>
  <ComboboxRoot
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :filter-function="(items, term) => items.filter(i => String(i).toLowerCase().includes(term.toLowerCase()))"
    reset-search-term-on-blur
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger
        :class="[
          'flex items-center justify-between gap-1 rounded-md border bg-background px-2 py-1 text-xs h-8 cursor-pointer hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
          modelValue !== 'all' ? 'border-primary min-w-[100px] max-w-[160px]' : 'w-[80px]'
        ]"
      >
        <span class="truncate">{{ modelValue === 'all' ? 'All' : modelValue }}</span>
        <svg class="w-3 h-3 flex-shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        align="start"
        class="z-50 w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <div class="p-1.5 border-b">
          <ComboboxInput
            placeholder="Search…"
            class="h-7 text-xs px-2 w-full rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <ComboboxViewport class="overflow-y-auto max-h-[240px] p-1">
          <ComboboxEmpty class="py-3 text-xs text-muted-foreground text-center">No results</ComboboxEmpty>
          <ComboboxItem value="all" class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">All</ComboboxItem>
          <ComboboxItem
            v-for="item in items"
            :key="item"
            :value="item"
            class="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
          >
            {{ item }}
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxTrigger,
  ComboboxInput,
  ComboboxContent,
  ComboboxViewport,
  ComboboxPortal,
  ComboboxEmpty,
  ComboboxItem,
} from 'reka-ui'

defineProps<{
  modelValue: string
  items: string[]
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
