<script setup lang="ts">
import { useAppStore } from '~/presentation/stores/app'

const store = useAppStore()
const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string

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

// Organization structured data. Inlined as a JSON-LD `<script>` so
// search engines and social platforms can parse site identity, social
// links, and contact info without crawling every page.
useHead({
  script: [
    {
      type: 'application/ld+json',
      // `innerHTML` is set explicitly (not via `v-html`) so the JSON
      // is rendered server-side and is part of the initial HTML.
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Friendship Community',
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        description:
          'Platform event & booking online untuk komunitas. Temukan event menarik, daftar via WhatsApp, kelola event Anda sendiri.',
        sameAs: [
          // // TODO: Replace with real social media URLs.
          // 'https://instagram.com/friendshipcommunity',
          // 'https://facebook.com/friendshipcommunity',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          availableLanguage: ['Indonesian', 'English'],
        },
      }),
    },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
