<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Local ComfyUI Settings</DialogTitle>
        <DialogDescription>
          Configure your local ComfyUI instance URL to open templates directly in your local environment.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="baseUrl">Local ComfyUI Base URL</Label>
          <Input
            id="baseUrl"
            v-model="localBaseUrl"
            placeholder="http://127.0.0.1:8188"
            class="w-full"
          />
          <p class="text-xs text-muted-foreground">
            Default: http://127.0.0.1:8188 (or http://localhost:8188)
          </p>
        </div>

        <div class="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div class="flex items-start gap-2">
            <svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="text-xs text-muted-foreground">
              <p class="font-medium text-foreground mb-1">Note:</p>
              <ul class="list-disc list-inside space-y-1">
                <li>Make sure your local ComfyUI is running</li>
                <li>This URL will be saved in your browser's local storage</li>
                <li>The template will open as: <code class="bg-muted px-1 rounded">YOUR_URL?template=TEMPLATE_NAME</code></li>
                <li><strong>Note:</strong> The template may not be available locally if it hasn't been published to your local instance</li>
              </ul>
            </div>
          </div>
        </div>

        <div v-if="saveSuccess" class="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Settings saved successfully!
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Cancel
        </Button>
        <Button @click="saveSettings">
          Save Settings
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = ref(props.open)
const localBaseUrl = ref('')
const saveSuccess = ref(false)

// Watch for prop changes
watch(() => props.open, (newValue) => {
  isOpen.value = newValue
  if (newValue) {
    // Load current value when dialog opens
    loadSettings()
  }
})

// Watch for internal changes
watch(isOpen, (newValue) => {
  emit('update:open', newValue)
})

const loadSettings = () => {
  const saved = localStorage.getItem('comfyui_local_base_url')
  if (saved) {
    localBaseUrl.value = saved
  } else {
    // Default value
    localBaseUrl.value = 'http://127.0.0.1:8188'
  }
  saveSuccess.value = false
}

const saveSettings = () => {
  // Remove trailing slash if present
  let url = localBaseUrl.value.trim()
  if (url.endsWith('/')) {
    url = url.slice(0, -1)
  }

  // Save to localStorage
  localStorage.setItem('comfyui_local_base_url', url)

  saveSuccess.value = true

  // Close dialog after a short delay
  setTimeout(() => {
    isOpen.value = false
    saveSuccess.value = false
  }, 1500)
}
</script>
