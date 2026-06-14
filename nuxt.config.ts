// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/google-fonts',
  ],

  runtimeConfig: {
    public: {
      appName: '',
      companyName: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
    },
  },

  googleFonts: {
    families: {
      'Plus Jakarta Sans': [300, 400, 500, 600, 700, 800],
    },
    display: 'swap',
  },

  css: ['~/assets/css/main.css'],

  tailwindcss: {
    configPath: 'tailwind.config.ts',
  },

  app: {
    head: {
      title: 'Event Management System',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Sistem Reservasi & Absensi Event Komunitas' },
      ],
      link: [
        { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css' },
      ],
    },
  },
  vite: {
    server: {
      allowedHosts: [
        'squishy-tyke-register.ngrok-free.dev', // Replace with your exact ngrok domain
      ]
    }
  },
})
