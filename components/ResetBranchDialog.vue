<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Branch to Upstream
        </DialogTitle>
        <DialogDescription class="space-y-3 pt-2">
          <p class="text-sm">
            Reset <code class="font-mono font-semibold">{{ branch }}</code> to match upstream
            <code class="font-mono">main</code> latest.
          </p>

          <div v-if="aheadBy > 0" class="dm-callout-warn p-3 text-sm">
            <p class="font-medium">This will discard {{ aheadBy }} local commit{{ aheadBy !== 1 ? 's' : '' }}.</p>
          </div>

          <div v-if="isDiverged" class="dm-callout-warn p-3 text-sm">
            <p class="font-medium">Branch has diverged from upstream. All local commits will be lost.</p>
          </div>

          <div class="flex items-start gap-2 pt-1">
            <input
              id="save-backup"
              v-model="saveBackup"
              type="checkbox"
              class="mt-1"
              :disabled="isProcessing"
            />
            <label for="save-backup" class="text-sm cursor-pointer">
              Save current state to a backup branch first
            </label>
          </div>

          <div v-if="saveBackup">
            <label class="text-sm font-medium mb-2 block">Backup Branch Name</label>
            <Input v-model="backupBranchName" :placeholder="suggestedBackupName" class="font-mono" />
            <p class="text-xs text-muted-foreground mt-1">
              Leave empty to use: <code class="font-mono">{{ suggestedBackupName }}</code>
            </p>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2 justify-end mt-4">
        <Button variant="outline" @click="handleCancel" :disabled="isProcessing">
          Cancel
        </Button>
        <Button
          variant="destructive"
          @click="handleConfirm"
          :disabled="isProcessing"
        >
          <svg v-if="isProcessing" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-if="isProcessing">Resetting...</span>
          <span v-else>Reset to Upstream</span>
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  branch: string
  aheadBy: number
  isDiverged: boolean
  suggestedBackupName: string
}>()

const emit = defineEmits<{
  confirm: [options: { saveToNewBranch: boolean; newBranchName?: string }]
}>()

const isOpen = ref(false)
const saveBackup = ref(true)
const backupBranchName = ref('')
const isProcessing = ref(false)

const show = () => {
  saveBackup.value = true
  backupBranchName.value = ''
  isProcessing.value = false
  isOpen.value = true
}

const handleCancel = () => {
  isOpen.value = false
  isProcessing.value = false
}

const handleConfirm = () => {
  isProcessing.value = true
  emit('confirm', {
    saveToNewBranch: saveBackup.value,
    newBranchName: saveBackup.value
      ? (backupBranchName.value.trim() || props.suggestedBackupName)
      : undefined
  })
}

const close = () => {
  isOpen.value = false
  isProcessing.value = false
}

const setProcessing = (value: boolean) => {
  isProcessing.value = value
}

defineExpose({ show, close, setProcessing })
</script>
