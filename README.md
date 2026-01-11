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
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=http://localhost:3000

# GitHub OAuth App
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# GitHub API Token (for repository operations)
GITHUB_TOKEN=your-github-personal-access-token

# GitHub Repository Settings (for template submissions)
GITHUB_OWNER=Comfy-Org
GITHUB_REPO=workflow_templates
```

### 4. Run development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## GitHub OAuth Setup

To enable GitHub authentication:

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App with:
   - Homepage URL: `http://localhost:3000` (or your production URL)
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Copy the Client ID and generate a Client Secret
4. Add these to your `.env` file

## GitHub Token Setup

For repository operations (reading templates, creating branches, etc.):

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with the following scopes:
   - `repo` (Full control of private repositories)
   - `read:user` (Read user profile data)
3. Add the token to your `.env` file as `GITHUB_TOKEN`

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

See [Deployment Guide](./docs/deployment.md) for detailed deployment instructions for various platforms.

### Quick Deploy to Vercel

```bash
npm run deploy:vercel
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
