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
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    },
    // DeepSeek AI Translation
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekApiEndpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    // Public (client-side)
    public: {
      repoOwner: 'Comfy-Org',
      repoName: 'workflow_templates',
      aiTranslationEnabled: !!process.env.DEEPSEEK_API_KEY
    }
  },

  // Server-side rendering
  ssr: true,

  // Nitro server configuration
  nitro: {
    experimental: {
      // Increase body size limit to handle large file uploads (100MB)
      // This allows uploading workflow files, thumbnails, and input assets
      bodySizeLimit: 100 * 1024 * 1024 // 100MB in bytes
    }
  },

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