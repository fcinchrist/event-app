// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/google-fonts',
    '@nuxt/image',
  ],

  // ---------------------------------------------------------------------------
  // Image optimization (LCP + responsive)
  // ---------------------------------------------------------------------------
  // - `format: ['webp','avif']` reduces image weight ~30-50% vs raw JPEG/PNG.
  // - `screens` match the Tailwind grid breakpoints used by EventCard.
  // - `domains` whitelists Supabase Storage so the IPX provider can fetch +
  //   transform images at the edge.
  // The `image` key is added at runtime by @nuxt/image, so we cast through
  // `as any` to keep the strict NuxtConfig types happy.
  // ---------------------------------------------------------------------------
  image: ({
    format: ['webp', 'avif'],
    quality: 80,
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536,
    },
    domains: [
      // Supabase Storage (e.g. <project-ref>.supabase.co)
      'supabase.co',
      'unsplash.com',
    ],
    provider: 'ipx',
    presets: {
      // Default preset for event cover images used by EventCard.
      eventCard: {
        modifiers: {
          format: 'webp',
          quality: 75,
          fit: 'cover',
        },
      },
    },
  } as any),

  runtimeConfig: {
    public: {
      appName: '',
      companyName: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
      // Placeholder URL for events that don't have a cover image yet.
      // Used by the `resolveEventImage()` helper in utils/event-image.ts
      // so public pages and the dashboard never render an `<img>` with
      // an empty / 404 src. Can be hosted on Supabase Storage, a CDN,
      // or a file in the public/ folder (absolute path).
      defaultEventImage: '',
      // Public site URL. Used for canonical, Open Graph, sitemap, and
      // structured data. Override per environment via NUXT_PUBLIC_SITE_URL.
      siteUrl: 'https://friendship-community.vercel.app',
    },
  },

  googleFonts: {
    families: {
      'Plus Jakarta Sans': [300, 400, 500, 600, 700, 800],
    },
    display: 'swap',
    preload: true,
  },

  css: ['~/assets/css/main.css'],

  tailwindcss: {
    configPath: 'tailwind.config.ts',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Friendship Community — Platform Event & Booking Komunitas',
      titleTemplate: '%s · Friendship Community',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content:
            'Friendship Community adalah platform event & booking online untuk komunitas. ' +
            'Temukan event menarik di sekitar Anda, daftar dengan mudah via WhatsApp, ' +
            'dan kelola event Anda sendiri lewat dashboard admin.',
        },
        {
          name: 'keywords',
          content:
            'event, komunitas, booking event, reservasi, friendship, ' +
            'event jakarta, event gratis, event indonesia, dashboard event',
        },
        { name: 'author', content: 'Friendship Community' },
        { name: 'theme-color', content: '#059669' },
        { name: 'format-detection', content: 'telephone=no' },
        // Open Graph (Facebook, LinkedIn, WhatsApp, Telegram)
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Friendship Community' },
        { property: 'og:title', content: 'Friendship Community — Platform Event & Booking Komunitas' },
        {
          property: 'og:description',
          content:
            'Temukan event menarik, daftar mudah via WhatsApp, kelola event Anda sendiri. ' +
            'Platform event & booking online untuk komunitas Indonesia.',
        },
        { property: 'og:url', content: 'https://friendship-community.vercel.app/' },
        { property: 'og:locale', content: 'id_ID' },
        { property: 'og:image', content: 'https://friendship-community.vercel.app/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Friendship Community — Platform Event & Booking Komunitas' },
        { property: 'og:image:type', content: 'image/png' },
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Friendship Community — Platform Event & Booking Komunitas' },
        {
          name: 'twitter:description',
          content: 'Temukan event menarik, daftar mudah via WhatsApp, kelola event Anda sendiri.',
        },
        { name: 'twitter:image', content: 'https://friendship-community.vercel.app/og-image.png' },
        { name: 'twitter:image:alt', content: 'Friendship Community — Platform Event & Booking Komunitas' },
        // Mobile / PWA
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Friendship' },
        // Robots (allow crawl by default; pages can override)
        { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
        { name: 'googlebot', content: 'index, follow' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: 'https://friendship-community.vercel.app/' },
        { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' },
        // Font Awesome: load async to avoid render-blocking.
        // The `media="print"` + `onload` trick makes the stylesheet
        // non-blocking and gets applied after the page loads.
        {
          rel: 'preload',
          as: 'style',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
        },
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
          media: 'print',
          onload: "this.media='all'",
        },
        // DNS prefetch + preconnect for Supabase (large images, etc.)
        { rel: 'dns-prefetch', href: 'https://cdnjs.cloudflare.com' },
        { rel: 'preconnect', href: 'https://cdnjs.cloudflare.com', crossorigin: '' },
        // Preconnect to Supabase Storage so the first event cover
        // image can start downloading in parallel with HTML parsing.
        { rel: 'preconnect', href: 'https://supabase.co', crossorigin: '' },
      ],
    },
  },
  vite: {
    server: {
      allowedHosts: [
        'squishy-tyke-register.ngrok-free.dev', // Replace with your exact ngrok domain
      ]
    },
    build: {
      // Inline small assets (< 4 kB) as base64 to avoid extra HTTP
      // roundtrips for icons, favicons, etc. Improves Performance by
      // reducing render-blocking requests.
      assetsInlineLimit: 4096,
    },
  },
  nitro: {
    // Long-term caching for static assets (font, images). Vercel
    // automatically honors these headers.
    routeRules: {
      '/favicon.ico': { headers: { 'cache-control': 'public, max-age=86400' } },
      '/og-image.png': { headers: { 'cache-control': 'public, max-age=86400' } },
      '/sitemap.xml': { headers: { 'cache-control': 'public, max-age=3600' } },
      '/robots.txt': { headers: { 'cache-control': 'public, max-age=86400' } },
      // @nuxt/image — serve transformed images with a long cache
      // lifetime. The URL already encodes the dimensions/format, so
      // different variants are cached independently.
      '/_ipx/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    },
  },
})
