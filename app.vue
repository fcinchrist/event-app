<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()

// initAuth is called at the root level so that:
// - It runs in SSR (cookie is read on the server, authUser is populated
//   before the HTML is sent).
// - It also runs on client hydration (state stays in sync).
// Goal: avoid jumping/flash in the header on refresh — the header needs
// `authUser` to render the Dashboard/Login/Logout buttons.
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
