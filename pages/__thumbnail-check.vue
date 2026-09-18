<template>
<Dialog :open="true"><DialogScrollContent overlay-class="overflow-hidden place-items-stretch" class="m-0 flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-2 rounded-none border-0 p-3 shadow-none sm:rounded-none sm:max-w-none lg:overflow-hidden">
<DialogHeader class="shrink-0 space-y-0 pr-8 text-left"><DialogTitle>Thumbnail editor · Preview</DialogTitle><DialogDescription>Choose a source, place overlay images on the canvas, then export as WebP.</DialogDescription></DialogHeader>
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