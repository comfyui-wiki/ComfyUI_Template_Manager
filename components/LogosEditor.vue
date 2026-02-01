<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <Label class="flex items-center gap-2">
        Provider Logos
        <span class="text-xs text-muted-foreground">(Optional)</span>
      </Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        @click="addLogo"
        class="h-7 text-xs"
      >
        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Logo
      </Button>
    </div>

    <!-- Logos List -->
    <div v-if="modelValue.length > 0" class="space-y-3">
      <div
        v-for="(logo, index) in modelValue"
        :key="index"
        class="border rounded-lg p-3 space-y-3 bg-card"
      >
        <!-- Header with Remove Button -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Logo {{ index + 1 }}</span>
            <!-- Preview of selected providers -->
            <div v-if="getProviderArray(logo).length > 0" class="flex items-center gap-1 px-2 py-1 bg-muted rounded-md">
              <div class="flex items-center" :style="{ gap: `${Math.max(-4, (logo.gap || -6) / 1.5)}px` }">
                <img
                  v-for="(provider, pIndex) in getProviderArray(logo)"
                  :key="`preview-${pIndex}`"
                  :src="getLogoUrl(provider)"
                  :alt="provider"
                  class="w-4 h-4 rounded object-contain bg-white/10 border border-border"
                  :style="{
                    marginLeft: pIndex > 0 ? `${Math.max(-4, (logo.gap || -6) / 1.5)}px` : '0',
                    zIndex: getProviderArray(logo).length - pIndex
                  }"
                />
              </div>
              <span class="text-xs text-muted-foreground">Preview</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            @click="removeLogo(index)"
            class="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <!-- Provider Selection (Single or Multiple) -->
        <div class="space-y-2">
          <Label class="text-xs">Provider(s)</Label>
          <div class="flex gap-2">
            <Select v-model="logo.isStacked" @update:model-value="handleStackedChange(index)">
              <SelectTrigger class="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="stacked">Stacked</SelectItem>
              </SelectContent>
            </Select>

            <!-- Single Provider Select -->
            <div v-if="logo.isStacked === 'single'" class="flex-1">
              <Select v-model="logo.provider">
                <SelectTrigger>
                  <SelectValue placeholder="Select provider">
                    <div v-if="logo.provider && typeof logo.provider === 'string'" class="flex items-center gap-2">
                      <img
                        :src="getLogoUrl(logo.provider)"
                        :alt="logo.provider"
                        class="w-4 h-4 rounded object-contain bg-white/10"
                      />
                      <span>{{ logo.provider }}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="provider in availableProviders"
                    :key="provider"
                    :value="provider"
                  >
                    <div class="flex items-center gap-2">
                      <img
                        :src="getLogoUrl(provider)"
                        :alt="provider"
                        class="w-4 h-4 rounded object-contain bg-white/10"
                      />
                      <span>{{ provider }}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Multiple Providers (Stacked) -->
            <div v-else class="flex-1">
              <div v-if="Array.isArray(logo.provider) && logo.provider.length > 0" class="flex flex-wrap gap-1.5 mb-2 p-2 border rounded-md bg-muted/30">
                <span
                  v-for="(provider, pIndex) in logo.provider"
                  :key="pIndex"
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md"
                >
                  <img
                    :src="getLogoUrl(provider)"
                    :alt="provider"
                    class="w-3.5 h-3.5 rounded object-contain bg-white/10"
                  />
                  <span>{{ provider }}</span>
                  <button
                    type="button"
                    @click="removeProvider(index, pIndex)"
                    class="hover:text-destructive ml-0.5"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <Select @update:model-value="(val) => addProvider(index, val)">
                <SelectTrigger>
                  <SelectValue placeholder="Add provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="provider in availableProviders"
                    :key="provider"
                    :value="provider"
                  >
                    <div class="flex items-center gap-2">
                      <img
                        :src="getLogoUrl(provider)"
                        :alt="provider"
                        class="w-4 h-4 rounded object-contain bg-white/10"
                      />
                      <span>{{ provider }}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <!-- Optional: Custom Label -->
        <div class="space-y-2">
          <Label class="text-xs">
            Custom Label
            <span class="text-muted-foreground">(Optional, defaults to provider name)</span>
          </Label>
          <Input
            v-model="logo.label"
            placeholder="e.g., 'Google & OpenAI'"
            class="h-8 text-xs"
          />
        </div>

        <!-- Optional: Gap (for stacked logos) -->
        <div v-if="logo.isStacked === 'stacked'" class="space-y-2">
          <Label class="text-xs">
            Gap (px)
            <span class="text-muted-foreground">(Negative for overlap, default: -6)</span>
          </Label>
          <Input
            v-model.number="logo.gap"
            type="number"
            placeholder="-6"
            class="h-8 text-xs"
          />
        </div>

        <!-- Advanced Options (Collapsible) -->
        <div class="border-t pt-3 mt-3">
          <button
            type="button"
            @click="logo.showAdvanced = !logo.showAdvanced"
            class="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <svg
              class="w-3.5 h-3.5 transition-transform"
              :class="{ 'rotate-90': logo.showAdvanced }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <span>Advanced Options (Optional)</span>
          </button>

          <div v-if="logo.showAdvanced" class="space-y-3 mt-3 pl-2">
            <!-- Position -->
            <div class="space-y-2">
              <Label class="text-xs">
                Position
                <span class="text-muted-foreground">(Tailwind classes, default: top-2 left-2)</span>
              </Label>
              <Input
                v-model="logo.position"
                placeholder="e.g., top-2 left-2, bottom-2 right-2"
                class="h-8 text-xs font-mono"
              />
              <p class="text-[10px] text-muted-foreground">
                Examples: top-2 left-2, top-2 right-2, bottom-2 left-2, bottom-2 right-2
              </p>
            </div>

            <!-- Opacity -->
            <div class="space-y-2">
              <Label class="text-xs">
                Opacity
                <span class="text-muted-foreground">(0-1, default: 0.85)</span>
              </Label>
              <Input
                v-model.number="logo.opacity"
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="0.85"
                class="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-6 border rounded-lg bg-muted/30">
      <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
      <p class="text-sm text-muted-foreground">No logos added</p>
      <p class="text-xs text-muted-foreground mt-1">Click "Add Logo" to display provider logos on the thumbnail</p>
    </div>

    <p class="text-xs text-muted-foreground">
      Add provider logos that will be displayed as overlays on the template thumbnail
    </p>
  </div>
</template>

<script setup lang="ts">
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LogoInfo {
  provider: string | string[]
  label?: string
  gap?: number
  position?: string
  opacity?: number
  isStacked?: 'single' | 'stacked' // Internal UI state
  showAdvanced?: boolean // Internal UI state for collapsible
}

interface Props {
  modelValue: LogoInfo[]
  availableProviders: string[]
  logoMapping: Record<string, string>
  repoBaseUrl: string
}

const props = defineProps<Props>()

// Helper function to get logo URL
const getLogoUrl = (provider: string): string => {
  const logoPath = props.logoMapping[provider]
  if (!logoPath || !props.repoBaseUrl) return ''
  return `${props.repoBaseUrl}/${logoPath}`
}

// Helper function to get provider array
const getProviderArray = (logo: LogoInfo): string[] => {
  if (Array.isArray(logo.provider)) {
    return logo.provider
  }
  return logo.provider ? [logo.provider] : []
}

const emit = defineEmits<{
  'update:modelValue': [value: LogoInfo[]]
}>()

const addLogo = () => {
  const newLogos = [
    ...props.modelValue,
    {
      provider: '',
      isStacked: 'single',
      showAdvanced: false
    }
  ]
  emit('update:modelValue', newLogos)
}

const removeLogo = (index: number) => {
  const newLogos = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', newLogos)
}

const handleStackedChange = (index: number) => {
  const logo = props.modelValue[index]
  const newLogos = [...props.modelValue]

  if (logo.isStacked === 'stacked') {
    // Changed to stacked - convert provider to array
    newLogos[index] = {
      ...logo,
      provider: logo.provider ? [logo.provider as string] : []
    }
  } else {
    // Changed to single - convert provider to string
    newLogos[index] = {
      ...logo,
      provider: Array.isArray(logo.provider) && logo.provider.length > 0 ? logo.provider[0] : ''
    }
  }

  emit('update:modelValue', newLogos)
}

const addProvider = (logoIndex: number, provider: string) => {
  const newLogos = [...props.modelValue]
  const logo = newLogos[logoIndex]

  if (Array.isArray(logo.provider)) {
    if (!logo.provider.includes(provider)) {
      logo.provider.push(provider)
    }
  } else {
    logo.provider = [provider]
  }

  emit('update:modelValue', newLogos)
}

const removeProvider = (logoIndex: number, providerIndex: number) => {
  const newLogos = [...props.modelValue]
  const logo = newLogos[logoIndex]

  if (Array.isArray(logo.provider)) {
    logo.provider = logo.provider.filter((_, i) => i !== providerIndex)
  }

  emit('update:modelValue', newLogos)
}
</script>
