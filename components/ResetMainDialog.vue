<template>
  <!-- Force Reset - Guide to GitHub -->
  <Dialog v-model:open="showForceResetConfirm">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-orange-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Discard Changes & Sync Fork
        </DialogTitle>
        <DialogDescription class="space-y-3 pt-2">
          <div class="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
            <p class="text-yellow-800 font-medium mb-2">⚠️ This will permanently discard:</p>
            <ul class="list-disc list-inside space-y-1 ml-2 text-yellow-700">
              <li>{{ aheadBy }} commit{{ aheadBy !== 1 ? 's' : '' }} on your fork's main branch</li>
              <li>All local changes</li>
            </ul>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <p class="text-blue-800 font-medium mb-2">📝 How to proceed:</p>
            <ol class="list-decimal list-inside space-y-2 ml-2 text-blue-700 text-xs">
              <li>We'll open your fork on GitHub</li>
              <li>Click the <strong>"Sync fork"</strong> button</li>
              <li>Choose <strong>"Discard commits"</strong> to force sync</li>
              <li>Your fork will be reset to upstream</li>
            </ol>
          </div>

          <p class="text-xs text-gray-600 italic">
            💡 This is the safest way to ensure your fork syncs correctly with upstream.
          </p>
        </DialogDescription>
      </DialogHeader>
      <div class="flex gap-2 justify-end mt-4">
        <Button
          variant="outline"
          @click="handleForceResetCancel"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          @click="handleOpenGitHubSync"
          class="bg-orange-600 hover:bg-orange-700"
        >
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Open on GitHub
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Save & Reset Dialog -->
  <Dialog v-model:open="showSaveResetDialog">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Save Changes & Sync Fork</DialogTitle>
        <DialogDescription class="space-y-3 pt-2">
          <p class="text-sm">
            Your fork's main branch has diverged from upstream. This process will:
          </p>
          <ol class="list-decimal list-inside text-sm space-y-1 ml-2">
            <li>Create a backup branch with your changes</li>
            <li>Guide you to sync your fork on GitHub</li>
          </ol>
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 mt-2">
        <div>
          <label class="text-sm font-medium mb-2 block">Backup Branch Name</label>
          <Input
            v-model="branchName"
            :placeholder="suggestedBranchName"
            class="font-mono"
          />
          <p class="text-xs text-muted-foreground mt-1">
            Leave empty to use: <code class="font-mono">{{ suggestedBranchName }}</code>
          </p>
        </div>

        <div class="p-3 bg-green-50 border border-green-200 rounded text-xs">
          <p class="text-green-800 font-medium mb-1">✓ Your changes will be safe!</p>
          <p class="text-green-700">
            Your {{ aheadBy }} commit{{ aheadBy !== 1 ? 's' : '' }} will be saved to the backup branch.
            Then we'll guide you to sync your fork on GitHub.
          </p>
        </div>

        <div class="flex gap-2 justify-end">
          <Button
            variant="outline"
            @click="handleSaveResetCancel"
            :disabled="isProcessing"
          >
            Cancel
          </Button>
          <Button
            @click="handleSaveResetConfirm"
            :disabled="isProcessing"
          >
            <svg v-if="isProcessing" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span v-if="isProcessing">Creating Backup...</span>
            <span v-else>Continue</span>
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Success - Guide to GitHub Sync -->
  <Dialog v-model:open="showGitHubGuideDialog">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-green-600">✓ Backup Created Successfully!</DialogTitle>
        <DialogDescription class="space-y-4 pt-3">
          <div class="bg-green-50 border border-green-200 rounded p-3 text-sm">
            <p class="text-green-800">
              ✓ Your changes have been saved to branch: <code class="font-mono font-semibold">{{ createdBranchName }}</code>
            </p>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded p-4">
            <p class="text-blue-800 font-medium mb-3">📝 Next: Sync your fork on GitHub</p>
            <ol class="list-decimal list-inside space-y-2 text-blue-700 text-sm ml-2">
              <li>Click the button below to open your fork</li>
              <li>Look for the <strong>"Sync fork"</strong> button (yellow banner)</li>
              <li>Click <strong>"Update branch"</strong> or <strong>"Discard commits"</strong></li>
              <li>Your fork will be synced with upstream!</li>
            </ol>
          </div>

          <div class="flex items-center gap-2 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>After syncing, refresh this page to see the updated templates.</p>
          </div>
        </DialogDescription>
      </DialogHeader>
      <div class="flex gap-2 justify-end mt-4">
        <Button variant="outline" @click="handleGuideClose">
          I'll do it later
        </Button>
        <Button @click="handleOpenGitHubSync" class="bg-green-600 hover:bg-green-700">
          <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Open GitHub & Sync Fork
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Error Dialog -->
  <Dialog v-model:open="showErrorDialog">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-red-600">✗ Error</DialogTitle>
        <DialogDescription class="pt-2">
          <div class="space-y-3 text-sm">
            <p class="text-red-700">{{ errorMessage }}</p>

            <!-- Permission error helper -->
            <div v-if="isPermissionError" class="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
              <p class="text-blue-800 font-medium mb-2">🔧 How to fix:</p>
              <ol class="list-decimal list-inside space-y-1 text-blue-700 text-xs">
                <li>Click "Sign Out" in the top right</li>
                <li>Sign in again with GitHub</li>
                <li>Authorize the permissions</li>
                <li>Try the operation again</li>
              </ol>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <div class="flex justify-end mt-4">
        <Button @click="handleErrorClose" :variant="isPermissionError ? 'default' : 'outline'">
          {{ isPermissionError ? 'Sign Out & Re-authenticate' : 'OK' }}
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
import { useAuth } from '#imports'

const props = defineProps<{
  aheadBy: number
  suggestedBranchName: string
  forkOwner: string
  forkRepo: string
}>()

const emit = defineEmits<{
  'create-backup': [branchName: string]
  'refresh': []
}>()

// Dialog states
const showForceResetConfirm = ref(false)
const showSaveResetDialog = ref(false)
const showGitHubGuideDialog = ref(false)
const showErrorDialog = ref(false)
const confirmText = ref('')
const branchName = ref('')
const isProcessing = ref(false)
const errorMessage = ref('')
const createdBranchName = ref('')

// Methods to show dialogs
const showForceReset = () => {
  confirmText.value = ''
  showForceResetConfirm.value = true
}

const showSaveReset = () => {
  branchName.value = ''
  showSaveResetDialog.value = true
}

const handleForceResetCancel = () => {
  confirmText.value = ''
  showForceResetConfirm.value = false
}

const handleSaveResetCancel = () => {
  branchName.value = ''
  showSaveResetDialog.value = false
}

const handleSaveResetConfirm = async () => {
  const finalBranchName = branchName.value.trim() || props.suggestedBranchName

  isProcessing.value = true
  showSaveResetDialog.value = false

  try {
    emit('create-backup', finalBranchName)
  } catch (error) {
    isProcessing.value = false
  }
}

const isPermissionError = computed(() => {
  return errorMessage.value.toLowerCase().includes('permission') ||
         errorMessage.value.toLowerCase().includes('auth')
})

const forkUrl = computed(() => {
  return `https://github.com/${props.forkOwner}/${props.forkRepo}`
})

const showSuccess = (branchName: string) => {
  createdBranchName.value = branchName
  showGitHubGuideDialog.value = true
  isProcessing.value = false
}

const showError = (message: string) => {
  errorMessage.value = message
  showErrorDialog.value = true
  isProcessing.value = false
}

const handleErrorClose = async () => {
  showErrorDialog.value = false

  // If permission error, redirect to sign out
  if (isPermissionError.value) {
    const { signOut } = useAuth()
    await signOut({ callbackUrl: '/' })
  }
}

const handleGuideClose = () => {
  showGitHubGuideDialog.value = false
  emit('refresh')
}

const handleOpenGitHubSync = () => {
  // Close all dialogs
  showForceResetConfirm.value = false
  showGitHubGuideDialog.value = false

  // Open GitHub fork page in new tab
  window.open(forkUrl.value, '_blank')

  // Emit refresh to update the UI
  emit('refresh')
}

// Expose methods to parent
defineExpose({
  showForceReset,
  showSaveReset,
  showSuccess,
  showError
})
</script>
