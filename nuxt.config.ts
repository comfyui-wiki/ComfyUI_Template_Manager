// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: '2025-11-21',

  // TypeScript configuration
  typescript: {
    typeCheck: false
  },

  // CSS
  css: ['~/assets/css/main.css'],

  // Modules
  modules: [
    '@vueuse/nuxt',
    '@nuxtjs/color-mode',
    'shadcn-nuxt',
    '@sidebase/nuxt-auth'
  ],

  shadcn: {
    prefix: '',
    componentDir: './components/ui'
  },

  colorMode: {
    classSuffix: ''
  },

  // Auth configuration
  auth: {
    baseURL: process.env.NEXTAUTH_URL || 'http://localhost:3000/api/auth',
    provider: {
      type: 'authjs'
    },
    globalAppMiddleware: false
  },

  // Runtime configuration
  runtimeConfig: {
    // Private (server-side only)
    authSecret: process.env.NEXTAUTH_SECRET,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      token: process.env.GITHUB_TOKEN
    },
    // Public (client-side)
    public: {
      repoOwner: 'Comfy-Org',
      repoName: 'workflow_templates'
    }
  },

  // Server-side rendering
  ssr: true,

  // Vite configuration for FFmpeg
  vite: {
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
    }
  },

  // PostCSS configuration for Tailwind
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
})