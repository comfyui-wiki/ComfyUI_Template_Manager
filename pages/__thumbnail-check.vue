<template>
<Dialog :open="true"><DialogScrollContent class="m-0 flex h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 p-4 sm:h-[min(96dvh,920px)] sm:w-[min(96vw,1280px)] sm:max-w-none sm:rounded-xl sm:border lg:overflow-hidden lg:p-6">
<DialogHeader class="shrink-0 pr-8"><DialogTitle>Thumbnail editor · Preview</DialogTitle><DialogDescription>Choose a source, place overlay images on the canvas, then export as WebP.</DialogDescription></DialogHeader>
<ThumbnailConverter class="min-h-0 flex-1" :initial-file="initial" />
</DialogScrollContent></Dialog>
</template>
<script setup lang="ts">
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle, DialogDescription } from '~/components/ui/dialog'
import ThumbnailConverter from '~/components/ThumbnailConverter.vue'
const initial = ref<File | null>(null)
onMounted(() => {
 const c = document.createElement('canvas'); c.width = 800; c.height = 600;
 const x = c.getContext('2d')!; const g = x.createLinearGradient(0,0,800,600);g.addColorStop(0,'#10284b');g.addColorStop(1,'#3ba89e');x.fillStyle=g;x.fillRect(0,0,800,600);x.fillStyle='white';x.font='48px sans-serif';x.fillText('Thumbnail preview',180,300);
 c.toBlob(b => { if(b) initial.value = new File([b], 'preview.png', {type:'image/png'}) })
})
</script>