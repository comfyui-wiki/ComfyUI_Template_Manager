import { NuxtAuthHandler } from '#auth'
import GithubProvider from 'next-auth/providers/github'

export default NuxtAuthHandler({
  secret: useRuntimeConfig().authSecret,

  // Important: Use JWT strategy to persist access token
  session: {
    strategy: 'jwt'
  },

  providers: [
    // @ts-expect-error
    GithubProvider.default({
      clientId: useRuntimeConfig().github.clientId,
      clientSecret: useRuntimeConfig().github.clientSecret,
      authorization: {
        params: {
          // Request these scopes (public repositories only - no private repo access)
          // 'public_repo' - Full control of public repositories (read/write)
          // 'read:user' - Read user profile information
          // 'user:email' - Read user email addresses
          scope: 'public_repo read:user user:email'
        }
      }
    })
  ],

  callbacks: {
    // Save GitHub access token to JWT token
    async jwt({ token, account, user, profile }) {
      console.log('[Auth JWT Callback] Called with:', {
        hasAccount: !!account,
        hasToken: !!token,
        hasUser: !!user,
        hasProfile: !!profile,
        accountAccessToken: account?.access_token ? 'present' : 'missing',
        profileLogin: (profile as any)?.login
      })

      if (account?.access_token) {
        token.accessToken = account.access_token
        console.log('[Auth JWT Callback] Saved access token to JWT')
      }

      if (user) {
        token.user = user
      }

      // Get GitHub username from profile
      if (profile && (profile as any).login) {
        if (!token.user) {
          token.user = {}
        }
        token.user.login = (profile as any).login
        console.log('[Auth JWT Callback] Saved GitHub login:', token.user.login)
      }

      return token
    },

    // Pass access token from JWT to session
    async session({ session, token }) {
      console.log('[Auth Session Callback] Called with:', {
        hasToken: !!token,
        hasAccessToken: !!token.accessToken,
        tokenAccessToken: token.accessToken ? 'present' : 'missing',
        tokenUserLogin: token.user?.login
      })

      if (token.accessToken) {
        session.accessToken = token.accessToken
        console.log('[Auth Session Callback] Added access token to session')
      }

      if (token.user) {
        session.user = {
          ...session.user,
          ...token.user
        }
        console.log('[Auth Session Callback] Added user to session with login:', session.user.login)
      }

      console.log('[Auth Session Callback] Final session:', {
        hasAccessToken: !!session.accessToken,
        userLogin: session.user?.login
      })

      return session
    }
  }
})
