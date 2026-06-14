<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

// initAuth dipanggil di level root agar:
// - Berjalan di SSR (cookie dibaca server, authUser terisi sebelum HTML dikirim)
// - Berjalan di client hydration (state tetap sinkron)
// Tujuan: hindari jumping/flash di header saat refresh — karena header
// butuh authUser untuk render tombol Dashboard/Login/Logout.
await useAsyncData('app:init-auth', async () => {
  if (store.authUser === null) {
    await store.initAuth()
  }
  return true
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
