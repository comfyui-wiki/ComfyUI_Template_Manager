<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-amber-900 dark:text-amber-200/95">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Warning: {{ actionType }} on Main Branch
        </DialogTitle>
        <DialogDescription class="space-y-3">
          <div class="dm-callout-warn rounded-lg p-4 space-y-2">
            <p class="text-sm font-semibold">
              {{ warningMessage }}
            </p>
            <p class="font-mono text-sm font-bold rounded px-2 py-1 bg-amber-200/45 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
              {{ repo }} / {{ branch }}
            </p>
          </div>

          <div class="text-sm text-muted-foreground space-y-2">
            <p class="font-semibold text-foreground">This is generally not recommended because:</p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li>Changes go live immediately without review</li>
              <li>No opportunity for pull request review</li>
              <li>Cannot easily revert if there are issues</li>
            </ul>
          </div>

          <div class="dm-callout-info rounded-lg p-3">
            <p class="text-sm">
              <strong>Recommended:</strong> Create a feature branch and submit a pull request instead.
            </p>
          </div>

          <p v-if="timing === 'saving'" class="text-sm font-semibold text-foreground pt-2">
            Are you sure you want to continue?
          </p>
          <p v-else class="text-sm font-semibold text-foreground pt-2">
            Please be careful when making changes on the main branch.
          </p>
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-3 pt-4">
        <Button
          variant="outline"
          class="flex-1"
          @click="handleCancel"
        >
          {{ timing === 'opening' ? 'Go Back' : 'Cancel' }}
        </Button>
        <Button
          variant="destructive"
          class="flex-1 bg-amber-800 hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600 text-white border-0"
          @click="handleConfirm"
        >
          {{ confirmButtonText }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'

interface Props {
  open: boolean
  repo: string
  branch: string
  actionType?: string
  timing?: 'opening' | 'saving'
}

const props = withDefaults(defineProps<Props>(), {
  actionType: 'Commit',
  timing: 'saving'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

// Computed message based on timing
const warningMessage = computed(() => {
  if (props.timing === 'opening') {
    return `⚠️ You are currently working on the main branch:`
  }
  return `⚠️ You are about to ${props.actionType.toLowerCase()} directly to the main branch:`
})

const confirmButtonText = computed(() => {
  if (props.timing === 'opening') {
    return 'I Understand, Continue'
  }
  return `Yes, ${props.actionType} to Main`
})

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const handleConfirm = () => {
  emit('confirm')
  isOpen.value = false
}

const handleCancel = () => {
  emit('cancel')
  isOpen.value = false
}
</script>
