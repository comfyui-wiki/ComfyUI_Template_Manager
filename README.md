# ComfyUI Template Admin

A modern web-based admin interface for managing ComfyUI workflow templates. This application allows you to browse, search, create, and manage workflow templates for ComfyUI with GitHub integration.

## Features

- **Template Management**: Browse, search, and filter ComfyUI workflow templates
- **GitHub Integration**:
  - OAuth authentication with GitHub
  - Fork and branch management
  - Multi-repository support
  - Diff detection between branches
  - Direct PR creation
- **Template Creation**: Upload and configure new workflow templates with:
  - Workflow JSON files
  - Thumbnail images (multiple formats supported)
  - Model embedding
  - Metadata management
- **Advanced Filtering**:
  - Search by name, title, or description
  - Filter by category, model, tags, and type
  - Sort by date or name
- **AI Translation (Optional)**:
  - DeepSeek API integration for automated translation
  - One-click translation for individual fields
  - Built-in security with rate limiting and whitelist
  - Configurable prompts and settings
- **Modern UI**: Built with Shadcn UI components and Tailwind CSS
- **Type-Safe**: Full TypeScript support
- **Testing**: Comprehensive test coverage with Vitest

## Tech Stack

- **Framework**: [Nuxt 3](https://nuxt.com/)
- **UI Library**: [Vue 3](https://vuejs.org/)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [Shadcn UI](https://www.shadcn-vue.com/) with [Reka UI](https://reka-ui.com/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) via [@sidebase/nuxt-auth](https://sidebase.com/nuxt-auth)
- **GitHub API**: [@octokit/rest](https://github.com/octokit/rest.js)
- **Testing**: [Vitest](https://vitest.dev/)
- **Validation**: [Zod](https://zod.dev/)

## Prerequisites

- Node.js 18+
- npm or yarn
- GitHub account (for authentication and integration)
- GitHub OAuth App credentials (for production deployment)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd template_cms
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=your-random-secret-here  # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000/api/auth

# GitHub OAuth App
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# AI Translation (Optional - uncomment to enable)
# DEEPSEEK_API_KEY=sk-xxxxx
# DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
# DEEPSEEK_MODEL=deepseek-chat
```

**Note**: `GITHUB_TOKEN` is NOT required. All GitHub operations use the user's OAuth token obtained during sign-in.

**AI Translation (Optional)**: To enable AI-powered translation, set `DEEPSEEK_API_KEY`. See [AI Translation Setup](#ai-translation-optional) for details.

### 4. Run development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## GitHub OAuth Setup

To enable GitHub authentication:

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Configure the OAuth App:
   - **Application name**: ComfyUI Template Manager (or your preferred name)
   - **Homepage URL**:
     - Development: `http://localhost:3000`
     - Production: `https://your-domain.vercel.app`
   - **Authorization callback URL**:
     - Development: `http://localhost:3000/api/auth/callback/github`
     - Production: `https://your-domain.vercel.app/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID**
6. Click "Generate a new client secret" and copy the **Client Secret**
7. Add these to your `.env` file (locally) or Vercel environment variables (production)

**Required OAuth Scopes**: The app automatically requests `read:user`, `user:email`, and `public_repo` permissions during sign-in.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run generate` - Generate static site
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run setup:github` - Setup GitHub integration

## Project Structure

```
template_cms/
├── assets/              # CSS and static assets
├── components/          # Vue components
│   └── ui/             # Shadcn UI components
├── composables/        # Vue composables
├── docs/               # Documentation
├── lib/                # Utility functions
├── pages/              # Nuxt pages (routes)
├── public/             # Public static files
├── scripts/            # Build and setup scripts
├── server/             # Nuxt server API routes
│   └── api/           # API endpoints
├── test/               # Test files
├── nuxt.config.ts      # Nuxt configuration
├── tailwind.config.js  # Tailwind CSS configuration
└── tsconfig.json       # TypeScript configuration
```

## Documentation

- [Architecture](./docs/architecture.md) - System architecture and design decisions
- [API Reference](./docs/api.md) - API endpoints and data structures
- [Components](./docs/components.md) - Component documentation
- [Deployment](./docs/deployment.md) - Deployment guide
- [Contributing](./docs/contributing.md) - Contributing guidelines

## Usage

### Browsing Templates

1. Visit the home page to see all available templates
2. Use the sidebar to filter by category
3. Use search and filters to find specific templates
4. Click on a template card to view details or edit (if authenticated)

### Creating Templates

1. Sign in with GitHub
2. Select or fork a repository with write access
3. Click "Create Template" button
4. Fill in the template form:
   - Upload workflow JSON file
   - Add thumbnail images
   - Configure metadata (title, description, tags, etc.)
   - Optionally embed model references
5. Submit to create the template

### Repository Management

1. Sign in with GitHub
2. Use the repository/branch switcher in the sidebar
3. Fork repositories or switch to your fork
4. Create new branches for your changes
5. View diff statistics comparing your branch to main

## AI Translation (Optional)

The application includes an optional AI-powered translation feature using the DeepSeek API. This feature helps translate template metadata across multiple languages.

### Features

- **One-Click Translation**: Translate individual fields with a single click
- **Multiple Languages**: Support for 11 languages (en, zh, zh-TW, ja, ko, es, fr, ru, tr, ar, pt-BR)
- **Security Protection**:
  - Rate limiting (20 requests/minute per user)
  - Origin verification (auto-detects from `NEXTAUTH_URL`)
  - GitHub authentication required
  - Whitelist support for trusted users
- **Real-Time Feedback**: Shows loading state and translation status
- **Configurable**: All prompts and settings in `config/i18n-config.json`

### Setup

#### Step 1: Get DeepSeek API Key

1. Sign up at [DeepSeek Platform](https://platform.deepseek.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `sk-`)

#### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
DEEPSEEK_API_KEY=sk-xxxxx
DEEPSEEK_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions  # Optional
DEEPSEEK_MODEL=deepseek-chat  # Optional
```

#### Step 3: Configure Security Settings

Edit `config/i18n-config.json`:

```json
{
  "aiTranslation": {
    "security": {
      "rateLimit": {
        "enabled": true,
        "maxRequestsPerMinute": 20
      },
      "originCheck": {
        "enabled": true,
        "allowedOrigins": []  // Empty = auto-use NEXTAUTH_URL
      },
      "whitelist": {
        "users": ["your-github-username"]  // Add your username for unlimited access
      }
    }
  }
}
```

#### Step 4: Restart Server

```bash
npm run dev
```

### Security Configuration

#### Rate Limiting

By default, each user is limited to 20 translation requests per minute. This prevents API abuse and controls costs.

**To adjust the limit:**

```json
{
  "aiTranslation": {
    "security": {
      "rateLimit": {
        "maxRequestsPerMinute": 50  // Increase or decrease as needed
      }
    }
  }
}
```

#### Origin Verification

The system automatically allows requests only from your configured domain (extracted from `NEXTAUTH_URL`).

**For multiple domains** (development + staging + production):

```json
{
  "aiTranslation": {
    "security": {
      "originCheck": {
        "enabled": true,
        "allowedOrigins": [
          "http://localhost:3000",
          "https://staging.yourdomain.com",
          "https://yourdomain.com"
        ]
      }
    }
  }
}
```

#### Whitelist for Trusted Users

Users in the whitelist bypass all rate limits and have unlimited translation access.

**To add users to whitelist:**

1. Get their GitHub username (visible when they sign in)
2. Add to `config/i18n-config.json`:

```json
{
  "aiTranslation": {
    "security": {
      "whitelist": {
        "users": [
          "admin-username",
          "trusted-translator-1",
          "trusted-translator-2"
        ]
      }
    }
  }
}
```

### Usage

1. **Access Translation Manager**:
   - Navigate to `/admin/i18n`
   - Or click "Manage Translations" in the admin panel

2. **Translate a Field**:
   - Click "Edit" on any cell (non-English language)
   - Click the purple lightbulb icon (AI translate button)
   - Review the AI-generated translation
   - Modify if needed and click "Save"

3. **Modified Cell Tracking**:
   - Recently translated/edited cells show a green border
   - This helps track which fields you've updated

### Error Messages

- **"Rate limit exceeded"**: You've exceeded the request limit. Wait 1 minute or add yourself to the whitelist.
- **"Request origin not allowed"**: Check that `NEXTAUTH_URL` is correctly configured.
- **"Unauthorized"**: Sign in with GitHub first.

### Cost Considerations

- DeepSeek API pricing: ~$0.14 per 1M input tokens, ~$0.28 per 1M output tokens
- Average translation (50 words): ~100 tokens ≈ $0.00003 per translation
- With default rate limit (20/min): Maximum ~$0.0006 per user per minute
- Whitelist users can bypass limits, so monitor their usage

### Documentation

- **Quick Start**: See `SECURITY-QUICKSTART.md`
- **Detailed Guide**: See `TODO-i18n-sync.md`
- **Configuration**: All settings in `config/i18n-config.json`

### Disable AI Translation

To disable the feature:

1. Remove or comment out `DEEPSEEK_API_KEY` from `.env`
2. Restart the server

The AI translate button will automatically disappear from the UI.

---

## Testing

Run the test suite:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test -- --watch
```

Run tests with coverage:

```bash
npm run test -- --coverage
```

## Deployment

### Deploy to Vercel (Recommended)

#### Step 1: Prepare Your GitHub OAuth App

Before deploying, create a GitHub OAuth App with your production URL:

1. Go to [GitHub OAuth Apps](https://github.com/settings/developers)
2. Create a new OAuth App or update existing one
3. Set **Authorization callback URL** to: `https://your-domain.vercel.app/api/auth/callback/github`
   - You can use Vercel's auto-generated domain (e.g., `your-project.vercel.app`)
   - Or configure a custom domain later

#### Step 2: Deploy to Vercel

**Option A: Using Vercel Dashboard (Recommended)**

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset**: Nuxt.js (auto-detected)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.output/public` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
5. Add environment variables:
   - `GITHUB_CLIENT_ID` - Your OAuth App Client ID
   - `GITHUB_CLIENT_SECRET` - Your OAuth App Client Secret
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` - `https://your-domain.vercel.app/api/auth`
6. Click "Deploy"

**Option B: Using Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Step 3: Update Environment Variables

After deployment, update `NEXTAUTH_URL` in Vercel:

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Update `NEXTAUTH_URL` to your actual domain: `https://your-actual-domain.vercel.app/api/auth`
4. Redeploy the project

#### Step 4: Update GitHub OAuth App

Update your GitHub OAuth App callback URL to match your deployed domain:

1. Go to [GitHub OAuth Apps](https://github.com/settings/developers)
2. Edit your OAuth App
3. Update **Authorization callback URL** to: `https://your-actual-domain.vercel.app/api/auth/callback/github`
4. Save changes

### Troubleshooting Vercel Deployment

#### Issue: 404 Error or Page Not Found

**Symptoms**: When you visit your deployed site, you see a 404 error or "Page Not Found" message.

**Solution**:

1. **Do NOT use `vercel.json`** - Vercel has built-in support for Nuxt 3 and will automatically detect it
2. If you have a `vercel.json` file, delete it: `rm vercel.json`
3. Make sure your `nuxt.config.ts` has `ssr: true` (already configured)
4. Verify environment variables are set correctly in Vercel dashboard
5. Check build logs in Vercel for any errors
6. Redeploy after removing `vercel.json`

**Note**: For Nuxt 3, Vercel automatically:
- Detects the framework
- Uses the correct build command (`npm run build`)
- Configures the output directory (`.output`)
- Sets up serverless functions for SSR

#### Issue: Environment Variables Not Working

**Symptoms**: OAuth fails, or you see "Unauthorized" errors.

**Solution**:

1. Double-check all 4 environment variables are set in Vercel dashboard
2. Make sure `NEXTAUTH_URL` includes `/api/auth` at the end
3. Verify GitHub OAuth callback URL matches your Vercel domain exactly
4. Redeploy after changing environment variables

#### Issue: OAuth Redirect Fails

**Symptoms**: After clicking "Sign in with GitHub", you get a redirect error.

**Solution**:

1. Verify GitHub OAuth App callback URL is: `https://your-domain.vercel.app/api/auth/callback/github`
2. Make sure `NEXTAUTH_URL` in Vercel is: `https://your-domain.vercel.app/api/auth`
3. Both URLs must match your actual Vercel domain
4. Use `https://` (not `http://`) for production

#### Issue: Build Fails

**Symptoms**: Deployment fails during build process.

**Solution**:

1. Check build logs in Vercel dashboard
2. Verify all dependencies are in `package.json`
3. Make sure Node.js version is 18+ (configured in Vercel project settings)
4. Try building locally first: `npm run build`

### Other Deployment Platforms

For deployment to other platforms (Netlify, AWS, etc.), see [Deployment Guide](./docs/deployment.md) (if available).

### Local Production Build

Test the production build locally before deploying:

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Contributing

We welcome contributions! Please see [Contributing Guide](./docs/contributing.md) for details.

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation in `/docs`

## Acknowledgments

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) - The amazing UI for Stable Diffusion
- [Shadcn UI](https://ui.shadcn.com/) - Beautiful component library
- [Nuxt 3](https://nuxt.com/) - The Intuitive Vue Framework
