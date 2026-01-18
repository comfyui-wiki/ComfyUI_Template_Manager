<template>
  <Dialog v-model:open="isOpen">
    <DialogScrollContent class="max-w-3xl max-h-[85vh] flex flex-col">
      <DialogHeader class="flex-shrink-0">
        <DialogTitle>Create Pull Request</DialogTitle>
        <DialogDescription>
          Review and customize your pull request details before submitting
        </DialogDescription>
      </DialogHeader>

      <!-- Scrollable Content Area -->
      <div class="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
        <!-- PR Title -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Title</label>
          <input
            v-model="prTitle"
            type="text"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter PR title..."
          />
        </div>

        <!-- PR Description -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Description</label>
          <textarea
            v-model="prDescription"
            rows="8"
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-none"
            placeholder="Enter PR description..."
          />
        </div>

        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Footer Actions - Fixed at bottom -->
      <div class="flex justify-end gap-2 border-t pt-4 flex-shrink-0">
        <Button variant="outline" @click="closeModal" :disabled="isSubmitting">
          Cancel
        </Button>
        <Button
          @click="handleSubmit"
          :disabled="!prTitle || !prDescription || isSubmitting"
        >
          <svg v-if="isSubmitting" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isSubmitting ? 'Creating...' : 'Create Pull Request' }}
        </Button>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

interface Props {
  open: boolean
  defaultTitle: string
  defaultDescription: string
  targetRepo: string
  targetBranch: string
  head: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': [pr: any]
}>()

const isOpen = ref(props.open)
const prTitle = ref(props.defaultTitle)
const prDescription = ref(props.defaultDescription)
const error = ref('')
const isSubmitting = ref(false)

watch(() => props.open, (value) => {
  isOpen.value = value
  if (value) {
    // Reset to default values when opened
    prTitle.value = props.defaultTitle
    prDescription.value = props.defaultDescription
    error.value = ''
  }
})

watch(isOpen, (value) => {
  emit('update:open', value)
})

// Close modal
const closeModal = () => {
  isOpen.value = false
}

// Handle submit
const handleSubmit = async () => {
  if (!prTitle.value || !prDescription.value) return

  error.value = ''
  isSubmitting.value = true

  try {
    const [owner, repo] = props.targetRepo.split('/')

    const response = await $fetch('/api/github/pr/create', {
      method: 'POST',
      body: {
        owner,
        repo,
        head: props.head,
        base: props.targetBranch,
        title: prTitle.value,
        body: prDescription.value
      }
    })

    if (response.success) {
      emit('created', response.pr)
      closeModal()
    } else {
      error.value = response.message || 'Failed to create pull request'
    }
  } catch (err: any) {
    console.error('[Create PR Modal] Error:', err)
    error.value = err.data?.message || err.message || 'Failed to create pull request'
  } finally {
    isSubmitting.value = false
  }
}
</script>
