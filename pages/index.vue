<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="border-b bg-card">
      <div class="container mx-auto px-4 py-4">
        <div class="space-y-3">
          <!-- Title and Actions Row -->
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold">ComfyUI Templates</h1>
              <p class="text-sm text-muted-foreground">Browse and manage workflow templates</p>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <LoginButton />

              <Button
                v-if="status === 'authenticated' && isMounted"
                @click="showTranslationManager = true"
                size="sm"
                variant="outline"
                :disabled="!canEditCurrentRepo || isViewingPR"
                :title="isViewingPR ? 'Cannot manage translations while browsing PR' : (canEditCurrentRepo ? 'Manage translations for all languages' : 'Select a branch with write access to manage translations')"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Translations
              </Button>

              <Button
                v-if="status === 'authenticated' && isMounted"
                @click="showUsageUpdateModal = true"
                size="sm"
                variant="outline"
                :disabled="!canEditCurrentRepo || isViewingPR"
                :title="isViewingPR ? 'Cannot update usage while browsing PR' : (canEditCurrentRepo ? 'Batch update template usage from CSV' : 'Select a branch with write access to update usage')"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Update Usage
              </Button>

              <Button
                v-if="status === 'authenticated' && isMounted"
                @click="navigateTo('/admin/edit/new')"
                size="sm"
                :disabled="!canEditCurrentRepo || isViewingPR"
                :title="isViewingPR ? 'Cannot create templates while browsing PR - switch to a branch with write access' : (canEditCurrentRepo ? 'Create a new template' : 'Select a branch with write access to create templates')"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Template
              </Button>
            </div>
          </div>

          <!-- Branch Info and PR Actions -->
          <div v-if="isMounted && selectedRepo && selectedBranch" class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
            <!-- Branch Info -->
            <div class="flex items-center gap-3 flex-wrap">
              <a
                :href="`https://github.com/${selectedRepo}/tree/${selectedBranch}`"
                target="_blank"
                class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors group"
              >
                <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                </svg>
                <span class="font-mono font-medium text-gray-700">{{ selectedRepo }}</span>
                <span class="text-gray-400">/</span>
                <span class="font-mono font-semibold text-gray-900">{{ selectedBranch }}</span>
                <svg class="w-3 h-3 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <!-- PR Status Badge -->
              <div v-if="prStatus" class="flex items-center gap-2">
                <!-- Open PR -->
                <a
                  v-if="prStatus.status === 'open'"
                  :href="prStatus.prUrl"
                  target="_blank"
                  class="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-md transition-colors"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM5 1a1.75 1.75 0 100 3.5A1.75 1.75 0 005 1zM3.25 12a1.75 1.75 0 113.5 0 1.75 1.75 0 01-3.5 0z"/>
                  </svg>
                  <span class="font-medium text-xs">PR #{{ prStatus.prNumber }} Open</span>
                </a>

                <!-- Merged PR -->
                <a
                  v-if="prStatus.status === 'merged'"
                  :href="prStatus.prUrl"
                  target="_blank"
                  class="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md transition-colors"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346zM12.75 9a.75.75 0 100-1.5.75.75 0 000 1.5zm-8.5 4.5a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
                  </svg>
                  <span class="font-medium text-xs">PR #{{ prStatus.prNumber }} Merged</span>
                </a>

                <!-- Closed PR -->
                <a
                  v-if="prStatus.status === 'closed' && !prStatus.isMerged"
                  :href="prStatus.prUrl"
                  target="_blank"
                  class="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3.25 1A2.25 2.25 0 001 3.25v9.5A2.25 2.25 0 003.25 15h9.5A2.25 2.25 0 0015 12.75v-9.5A2.25 2.25 0 0012.75 1h-9.5zm9.5 1.5a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75h-9.5a.75.75 0 01-.75-.75v-9.5a.75.75 0 01.75-.75h9.5z"/>
                  </svg>
                  <span class="font-medium text-xs">PR #{{ prStatus.prNumber }} Closed</span>
                </a>
              </div>
            </div>

            <!-- PR Action Buttons -->
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Update Branch Button (when PR has new commits) -->
              <Button
                v-if="prNeedsUpdate"
                @click="handleUpdateBranch"
                size="sm"
                variant="default"
                :disabled="isUpdatingBranch"
                class="gap-1.5 text-xs whitespace-nowrap"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {{ isUpdatingBranch ? 'Updating...' : `Update (${prUpdateInfo?.comparison?.aheadBy || 0})` }}
              </Button>

              <!-- Browse PRs Button (requires login) -->
              <Button
                v-if="isMounted && status === 'authenticated'"
                @click="showPRBrowser = true"
                size="sm"
                variant="outline"
                class="gap-1.5 text-xs whitespace-nowrap"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM5 1a1.75 1.75 0 100 3.5A1.75 1.75 0 005 1zM3.25 12a1.75 1.75 0 113.5 0 1.75 1.75 0 01-3.5 0z"/>
                </svg>
                Browse PRs
              </Button>

              <!-- Create PR Button -->
              <Button
                v-if="shouldShowCreatePR"
                @click="handleCreatePR"
                size="sm"
                variant="outline"
                :disabled="isCreatingPR"
                class="gap-1.5 text-xs whitespace-nowrap"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM5 1a1.75 1.75 0 100 3.5A1.75 1.75 0 005 1zM3.25 12a1.75 1.75 0 113.5 0 1.75 1.75 0 01-3.5 0z"/>
                </svg>
                {{ isCreatingPR ? 'Creating...' : 'Create PR' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Error Banner -->
    <div v-if="errorMessage" class="border-b bg-red-50">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm text-red-900 font-medium">{{ errorMessage }}</p>
          </div>
          <button
            @click="errorMessage = null"
            class="text-red-600 hover:text-red-800 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Browsing PR Notice Banner (always show when viewing PR branch) -->
    <div v-if="isMounted && isViewingPR && !prNoticeDismissed" class="border-b bg-purple-50">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M1.5 3.25a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM5 1a1.75 1.75 0 100 3.5A1.75 1.75 0 005 1zM3.25 12a1.75 1.75 0 113.5 0 1.75 1.75 0 01-3.5 0z"/>
          </svg>
          <div class="flex-1">
            <p class="text-sm text-purple-900 font-medium">Browsing PR Branch - Read-Only Mode</p>
            <p class="text-xs text-purple-800 mt-1">
              You're viewing a pull request branch <span class="font-mono font-semibold">{{ selectedRepo }}</span> / <span class="font-mono font-semibold">{{ selectedBranch }}</span>.
              Editing is disabled. To make changes, please switch to a branch you have write access to.
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button
                v-if="status === 'authenticated'"
                size="sm"
                variant="outline"
                class="h-7 text-xs bg-white hover:bg-purple-50"
                @click="scrollToSidebar"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 12h12m-12 5h12M4 7h.01M4 12h.01M4 17h.01" />
                </svg>
                Switch Branch
              </Button>
            </div>
          </div>
          <button @click="prNoticeDismissed = true" class="text-purple-600 hover:text-purple-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Permission Notice Banner (only show if no write access to repository at all) -->
    <div v-if="isMounted && status === 'authenticated' && !hasRepoWriteAccess && !isViewingPR && !noticeDismissed" class="border-b bg-blue-50">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm text-blue-900 font-medium">Read-only mode</p>
            <p class="text-xs text-blue-800 mt-1">
              You're viewing <span class="font-mono font-semibold">{{ selectedRepo }}</span> / <span class="font-mono font-semibold">{{ selectedBranch }}</span> in read-only mode.
              To create or edit templates:
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Button
                v-if="!hasFork"
                size="sm"
                variant="outline"
                class="h-7 text-xs bg-white hover:bg-blue-50"
                @click="scrollToSidebar"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Fork repository
              </Button>
              <Button
                v-else
                size="sm"
                variant="outline"
                class="h-7 text-xs bg-white hover:bg-blue-50"
                @click="scrollToSidebar"
              >
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Switch to your fork
              </Button>
            </div>
          </div>
          <button @click="dismissNotice" class="text-blue-600 hover:text-blue-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content with Sidebar -->
    <div class="w-full px-4 py-6">
      <div class="flex gap-6 max-w-[1920px] mx-auto">
        <!-- Sidebar -->
        <aside class="w-64 flex-shrink-0 hidden lg:block" id="sidebar">
          <div class="sticky top-6 space-y-4">
            <!-- Repository & Branch Switcher (only when logged in) -->
            <RepoAndBranchSwitcher v-if="isMounted && status === 'authenticated'" />

            <Card>
              <CardHeader>
                <CardTitle class="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent class="p-0">
                <div class="space-y-1">
                  <!-- All Categories -->
                  <button
                    @click="selectedCategory = 'all'"
                    :class="[
                      'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors',
                      selectedCategory === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    ]"
                  >
                    <span>All Templates</span>
                    <span class="text-xs opacity-70">{{ allTemplates.length }}</span>
                  </button>

                  <!-- Category List -->
                  <button
                    v-for="category in categories"
                    :key="category.title"
                    @click="selectedCategory = category.title"
                    :class="[
                      'w-full flex items-center justify-between px-4 py-2 text-sm transition-colors',
                      selectedCategory === category.title
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    ]"
                  >
                    <span>{{ category.title }}</span>
                    <span class="text-xs opacity-70">{{ category.templates?.length || 0 }}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        <!-- Main Content -->
        <div class="flex-1 min-w-0">
          <!-- Search and Sort -->
          <div class="flex flex-col sm:flex-row gap-4 mb-4">
            <!-- Search -->
            <div class="flex-1">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  v-model="searchQuery"
                  placeholder="Search templates..."
                  class="pl-10"
                />
              </div>
            </div>

            <!-- Sort -->
            <Select v-model="sortBy">
              <SelectTrigger class="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (from index.json)</SelectItem>
                <SelectItem value="latest">Latest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Filters Row -->
          <div class="flex flex-wrap gap-4 mb-6 items-center">
            <!-- Model Filter -->
            <Select v-model="selectedModel">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Model Filter" />
              </SelectTrigger>
              <SelectContent class="max-h-[300px]">
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem v-for="model in allModels" :key="model" :value="model">
                  {{ model }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- Tag Filter (Use Case) -->
            <Select v-model="selectedTag">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Use Case" />
              </SelectTrigger>
              <SelectContent class="max-h-[300px]">
                <SelectItem value="all">All Tags</SelectItem>
                <SelectItem v-for="tag in allTags" :key="tag" :value="tag">
                  {{ tag }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- Type Filter -->
            <Select v-model="selectedRunsOn">
              <SelectTrigger class="w-[200px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="opensource">Open Source</SelectItem>
              </SelectContent>
            </Select>

            <!-- Diff Status Filter (only show when authenticated and viewing a branch) -->
            <Select v-if="isMounted && status === 'authenticated' && selectedBranch" v-model="selectedDiffStatus">
              <SelectTrigger class="w-[220px]">
                <SelectValue placeholder="Changes vs Main" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                <SelectItem value="new">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>New vs Main</span>
                  </div>
                </SelectItem>
                <SelectItem value="modified">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span>Modified vs Main</span>
                  </div>
                </SelectItem>
                <SelectItem value="deleted">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>Deleted vs Main</span>
                  </div>
                </SelectItem>
                <SelectItem value="unchanged">Identical to Main</SelectItem>
              </SelectContent>
            </Select>

            <!-- Clear Filters Button -->
            <Button
              v-if="selectedModel !== 'all' || selectedTag !== 'all' || selectedRunsOn !== 'all' || selectedDiffStatus !== 'all' || searchQuery"
              variant="outline"
              size="sm"
              @click="clearFilters"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filters
            </Button>
          </div>

          <!-- Debug Panel (only in development) -->
          <div v-if="false" class="mb-4 p-4 bg-gray-100 rounded text-xs font-mono">
            <div><strong>Current Repo:</strong> {{ selectedRepo }}</div>
            <div><strong>Current Branch:</strong> {{ selectedBranch }}</div>
            <div><strong>Categories loaded:</strong> {{ categories.length }}</div>
            <div><strong>Diff Stats:</strong> {{ JSON.stringify(diffStats) }}</div>
            <div><strong>Sample template diffStatus:</strong> {{ categories[0]?.templates?.[0]?.diffStatus }}</div>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span>{{ filteredTemplates.length }} templates</span>
            <span v-if="selectedCategory !== 'all'">in {{ categoryTitle }}</span>

            <!-- Diff Stats -->
            <div v-if="isMounted && status === 'authenticated' && selectedRepo && selectedBranch" class="flex items-center gap-3 ml-auto">
              <span class="text-xs">
                <span class="font-mono">{{ selectedRepo }}</span> /
                <span class="font-mono font-semibold">{{ selectedBranch }}</span>
              </span>
              <span v-if="diffStats.new > 0" class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium" title="Templates added compared to main branch">
                +{{ diffStats.new }} new vs main
              </span>
              <span v-if="diffStats.modified > 0" class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium" title="Templates modified compared to main branch">
                ~{{ diffStats.modified }} modified vs main
              </span>
              <span v-if="diffStats.deleted > 0" class="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium" title="Templates deleted compared to main branch">
                -{{ diffStats.deleted }} deleted vs main
              </span>
              <span v-if="diffStats.new === 0 && diffStats.modified === 0 && diffStats.deleted === 0" class="text-xs text-muted-foreground">
                ✓ Identical to main
              </span>
              <Button
                variant="ghost"
                size="sm"
                @click="refreshTemplates"
                :disabled="loading"
                class="h-7 px-2"
                title="Refresh and compare with main branch"
              >
                <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p class="mt-4 text-muted-foreground">Loading templates...</p>
      </div>

          <!-- Empty State -->
          <div v-else-if="filteredTemplates.length === 0" class="text-center py-12">
            <svg class="mx-auto w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-medium mb-2">No templates found</h3>
            <p class="text-muted-foreground mb-4">Try adjusting your search or filters</p>
          </div>

          <!-- Templates Grid - Always show flat grid for proper sorting -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            <TemplateCard
              v-for="template in filteredTemplates"
              :key="template.name"
              :template="template"
              :category="template.categoryTitle"
              :can-edit="isMounted && canEditCurrentRepo && !isViewingPR"
              :repo="selectedRepo"
              :branch="selectedBranch"
              :cache-bust="cacheBustTimestamp"
              :commit-sha="latestCommitSha"
              @edit="editTemplate"
              @view="viewTemplate"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- PR Browser Dialog -->
    <PRBrowser
      v-model:open="showPRBrowser"
      :repo="'Comfy-Org/workflow_templates'"
      @switch-branch="handleSwitchToPRBranch"
    />

    <!-- Translation Manager Dialog -->
    <TranslationManager
      v-model:open="showTranslationManager"
    />

    <!-- Usage Update Modal -->
    <UsageUpdateModal
      v-if="isMounted"
      v-model:open="showUsageUpdateModal"
      :repo="selectedRepo"
      :branch="selectedBranch"
      @updated="handleUsageUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onActivated, watch } from 'vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import LoginButton from '~/components/LoginButton.vue'
import TemplateCard from '~/components/TemplateCard.vue'
import RepoAndBranchSwitcher from '~/components/RepoAndBranchSwitcher.vue'
import PRBrowser from '~/components/PRBrowser.vue'
import TranslationManager from '~/components/TranslationManager.vue'
import UsageUpdateModal from '~/components/UsageUpdateModal.vue'

const { status } = useAuth()
const route = useRoute()

// Error message from redirects
const errorMessage = ref<string | null>(null)

// GitHub repo and branch management
const {
  selectedRepo,
  selectedBranch,
  hasRepoWriteAccess,
  canEditCurrentRepo,
  hasFork,
  hasMainRepoAccess,
  branchPermission,
  checkBranchPermission,
  initialize: initializeGitHub
} = useGitHubRepo()

// Template diff detection
const {
  categoriesWithDiff,
  diffStats,
  isLoading: diffLoading,
  loadCurrentTemplates,
  isMainBranch,
  clearCache
} = useTemplateDiff()

// State
const loading = ref(true)
const searchQuery = ref('')
const selectedCategory = ref('all')
const selectedModel = ref('all')
const selectedTag = ref('all')
const selectedRunsOn = ref('all') // all, api, opensource
const selectedDiffStatus = ref('all') // all, new, modified, deleted, unchanged
const sortBy = ref('default')
const noticeDismissed = ref(false)
const showTranslationManager = ref(false)
const showUsageUpdateModal = ref(false)
const prNoticeDismissed = ref(false)
const isMounted = ref(false) // Track if component is mounted (client-side only)

// PR Status
const prStatus = ref<any>(null)
const isCreatingPR = ref(false)
const showPRBrowser = ref(false)

// PR Update Status
const prUpdateInfo = ref<any>(null)
const isUpdatingBranch = ref(false)

// Track if we're viewing a PR branch (for browsing PRs)
const viewingPRBranch = ref<string | null>(null)

// Load templates from selected repository and branch
const loadTemplates = async (owner: string, repo: string, branch: string, forceRefresh = false) => {
  console.log(`[LoadTemplates] Loading from ${owner}/${repo}/${branch}`, forceRefresh ? '(force refresh)' : '')
  loading.value = true
  try {
    // Check branch permission in parallel with loading templates
    await Promise.all([
      loadCurrentTemplates(owner, repo, branch, forceRefresh),
      status.value === 'authenticated' ? checkBranchPermission(owner, repo, branch) : Promise.resolve()
    ])
    console.log('[LoadTemplates] Templates loaded successfully')
    console.log('[LoadTemplates] Categories with diff:', categoriesWithDiff.value?.length || 0)
    console.log('[LoadTemplates] Diff stats:', diffStats.value)
    console.log('[LoadTemplates] Branch permission:', branchPermission.value)
  } catch (error) {
    console.error('[LoadTemplates] Failed to load templates:', error)
  } finally {
    loading.value = false
  }
}

// Track page visibility for smart refresh
const lastVisitTime = ref(Date.now())

// Cache-busting timestamp (updated when we force refresh)
// We use commit SHA for better CDN cache busting
const cacheBustTimestamp = ref<number | undefined>(undefined)
const latestCommitSha = ref<string | undefined>(undefined)

// Fetch latest commit SHA for cache busting
const fetchLatestCommitSha = async (owner: string, repo: string, branch: string) => {
  try {
    if (status.value === 'authenticated') {
      // Use GitHub API with authentication
      const response = await $fetch(`/api/github/latest-commit`, {
        query: { owner, repo, branch }
      })
      return response.sha
    } else {
      // Fallback to public GitHub API
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`)
      if (response.ok) {
        const data = await response.json()
        return data.sha
      }
    }
  } catch (error) {
    console.error('[fetchLatestCommitSha] Failed to fetch commit SHA:', error)
  }
  return undefined
}

// Initial load - initialize GitHub and load templates
onMounted(async () => {
  // Check for error messages from redirects
  if (route.query.error === 'no_permission_create') {
    errorMessage.value = 'Cannot create templates on this branch. You need write access to create templates.'
    // Clear error message after 8 seconds
    setTimeout(() => {
      errorMessage.value = null
      // Clean up URL
      navigateTo('/', { replace: true })
    }, 8000)
  } else if (route.query.error === 'no_permission_edit') {
    errorMessage.value = 'Cannot edit templates on this branch. You need write access to edit templates.'
    // Clear error message after 8 seconds
    setTimeout(() => {
      errorMessage.value = null
      // Clean up URL
      navigateTo('/', { replace: true })
    }, 8000)
  }

  // Mark as mounted to enable client-only rendering
  isMounted.value = true

  // Initialize GitHub repo/branch management (checks permissions and fork status)
  if (status.value === 'authenticated') {
    await initializeGitHub()
  }

  // Check if we just saved a template (force refresh if so)
  let forceRefresh = false
  if (process.client && sessionStorage.getItem('template_just_saved') === 'true') {
    console.log('[Homepage] Detected recent template save, forcing refresh')
    forceRefresh = true
    sessionStorage.removeItem('template_just_saved')
  }

  // Load templates from selected repo/branch (or default to main)
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  const [owner, name] = repo.split('/')

  if (forceRefresh) {
    // Clear cache before loading
    clearCache(owner, name, branch)
    // Fetch latest commit SHA for stronger CDN cache busting
    const sha = await fetchLatestCommitSha(owner, name, branch)
    if (sha) {
      latestCommitSha.value = sha
      cacheBustTimestamp.value = Date.now() // Also set timestamp as fallback
      console.log('[Homepage] Using commit SHA for cache bust:', sha.substring(0, 8))
    } else {
      cacheBustTimestamp.value = Date.now() // Fallback to timestamp
    }
  }

  await loadTemplates(owner, name, branch, forceRefresh)

  // Check PR status after loading templates
  if (status.value === 'authenticated') {
    await checkPRStatus()
  }

  // Listen for page visibility changes (user returns to this page)
  if (process.client) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }
})

// Clean up event listener
onBeforeUnmount(() => {
  if (process.client) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
})

// Handle component activation (when kept-alive component is reused)
onActivated(async () => {
  console.log('[onActivated] Component activated, checking for template_just_saved flag')

  // Check if template was just saved
  if (process.client && sessionStorage.getItem('template_just_saved') === 'true') {
    console.log('[onActivated] Template just saved - forcing cache refresh')
    sessionStorage.removeItem('template_just_saved')

    if (selectedRepo.value && selectedBranch.value) {
      const [owner, name] = selectedRepo.value.split('/')
      // Clear cache for this specific repo/branch before refreshing
      clearCache(owner, name, selectedBranch.value)
      // Fetch latest commit SHA for stronger CDN cache busting
      const sha = await fetchLatestCommitSha(owner, name, selectedBranch.value)
      if (sha) {
        latestCommitSha.value = sha
        cacheBustTimestamp.value = Date.now()
        console.log('[onActivated] Using commit SHA for cache bust:', sha.substring(0, 8))
      } else {
        cacheBustTimestamp.value = Date.now()
      }
      await loadTemplates(owner, name, selectedBranch.value, true) // Force refresh
      // Also refresh PR status
      if (status.value === 'authenticated') {
        await checkPRStatus()
      }
    }
  }
})

// Handle page becoming visible again (user returned from edit page)
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    const timeSinceLastVisit = Date.now() - lastVisitTime.value

    // Check if template was just saved (even if returned quickly)
    const justSaved = process.client && sessionStorage.getItem('template_just_saved') === 'true'
    if (justSaved) {
      console.log('[Page Visible] Template just saved - forcing cache refresh')
      sessionStorage.removeItem('template_just_saved')
    }

    // If user was away for more than 2 seconds OR just saved a template, force refresh
    // This catches quick edits where user saves and immediately returns
    if (timeSinceLastVisit > 2000 || justSaved) {
      if (justSaved) {
        console.log('[Page Visible] User returned after saving - refreshing data')
      } else {
        console.log('[Page Visible] User returned after', Math.round(timeSinceLastVisit / 1000), 'seconds - refreshing data')
      }

      if (selectedRepo.value && selectedBranch.value) {
        const [owner, name] = selectedRepo.value.split('/')
        // Clear cache for this specific repo/branch before refreshing
        clearCache(owner, name, selectedBranch.value)
        // Fetch latest commit SHA for stronger CDN cache busting
        const sha = await fetchLatestCommitSha(owner, name, selectedBranch.value)
        if (sha) {
          latestCommitSha.value = sha
          cacheBustTimestamp.value = Date.now()
          console.log('[Page Visible] Using commit SHA for cache bust:', sha.substring(0, 8))
        } else {
          cacheBustTimestamp.value = Date.now()
        }
        await loadTemplates(owner, name, selectedBranch.value, true) // Force refresh
        // Also refresh PR status
        if (status.value === 'authenticated') {
          await checkPRStatus()
        }
      }
    }

    lastVisitTime.value = Date.now()
  }
}

// Watch for authentication status changes
watch(status, async (newStatus) => {
  if (newStatus === 'authenticated') {
    await initializeGitHub()
    await checkPRStatus()
  }
})

// Watch for repository or branch changes
watch([selectedRepo, selectedBranch], ([repo, branch], [oldRepo, oldBranch]) => {
  console.log('[Watch] Branch changed:', { oldRepo, oldBranch, repo, branch })

  // If user manually switches branch (not through PR browser), clear PR browsing mode
  const currentKey = `${repo}/${branch}`
  if (viewingPRBranch.value && viewingPRBranch.value !== currentKey) {
    console.log('[Watch] User manually switched branch, clearing PR browsing mode')
    viewingPRBranch.value = null
    prNoticeDismissed.value = false
  }

  if (repo && branch) {
    const [owner, name] = repo.split('/')
    console.log('[Watch] Loading templates for:', owner, name, branch)
    loadTemplates(owner, name, branch)
  }
}, { immediate: false })

// Manual refresh function (force refresh from API)
const refreshTemplates = async () => {
  if (selectedRepo.value && selectedBranch.value) {
    const [owner, name] = selectedRepo.value.split('/')
    console.log('[Manual Refresh] Clearing cache and reloading templates from:', owner, name, selectedBranch.value)
    // Clear cache first to ensure fresh data
    clearCache(owner, name, selectedBranch.value)
    // Fetch latest commit SHA for stronger CDN cache busting
    const sha = await fetchLatestCommitSha(owner, name, selectedBranch.value)
    if (sha) {
      latestCommitSha.value = sha
      cacheBustTimestamp.value = Date.now()
      console.log('[Manual Refresh] Using commit SHA for cache bust:', sha.substring(0, 8))
    } else {
      cacheBustTimestamp.value = Date.now()
    }
    await loadTemplates(owner, name, selectedBranch.value, true) // Force refresh
  }
}

// Handle usage data updated
const handleUsageUpdated = async () => {
  console.log('[Usage Update] Templates updated, refreshing data...')
  await refreshTemplates()
}

// Computed
const categories = computed(() => {
  return categoriesWithDiff.value || []
})

// Check if we're viewing a PR branch (browsing mode, editing disabled)
const isViewingPR = computed(() => {
  return viewingPRBranch.value !== null
})

const categoryTitle = computed(() => {
  const cat = categories.value.find(c => c.title === selectedCategory.value)
  return cat?.title || ''
})

const allTemplates = computed(() => {
  const templates: any[] = []
  categories.value.forEach((category: any) => {
    category.templates?.forEach((template: any) => {
      const enrichedTemplate = {
        ...template,
        categoryTitle: category.title
      }
      templates.push(enrichedTemplate)
    })
  })

  return templates
})

const allModels = computed(() => {
  const models = new Set<string>()
  allTemplates.value.forEach(t => {
    if (t.models && Array.isArray(t.models)) {
      t.models.forEach((model: string) => models.add(model))
    }
  })
  return Array.from(models).sort()
})

const allTags = computed(() => {
  const tags = new Set<string>()
  allTemplates.value.forEach(t => {
    if (t.tags && Array.isArray(t.tags)) {
      t.tags.forEach((tag: string) => tags.add(tag))
    }
  })
  return Array.from(tags).sort()
})

const filteredTemplates = computed(() => {
  let templates = allTemplates.value

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    templates = templates.filter(t =>
      t.name?.toLowerCase().includes(query) ||
      t.title?.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    )
  }

  // Filter by category
  if (selectedCategory.value !== 'all') {
    templates = templates.filter(t => t.categoryTitle === selectedCategory.value)
  }

  // Filter by model
  if (selectedModel.value !== 'all') {
    templates = templates.filter(t =>
      t.models && Array.isArray(t.models) && t.models.includes(selectedModel.value)
    )
  }

  // Filter by tag
  if (selectedTag.value !== 'all') {
    templates = templates.filter(t =>
      t.tags && Array.isArray(t.tags) && t.tags.includes(selectedTag.value)
    )
  }

  // Filter by runs on (API vs Open Source)
  if (selectedRunsOn.value === 'api') {
    templates = templates.filter(t => t.openSource === false)
  } else if (selectedRunsOn.value === 'opensource') {
    templates = templates.filter(t => t.openSource !== false)
  }

  // Filter by diff status
  if (selectedDiffStatus.value !== 'all') {
    templates = templates.filter(t => t.diffStatus === selectedDiffStatus.value)
  }

  // Sort
  if (sortBy.value === 'default') {
    // Keep natural order from index.json (preserves the order from your branch)
    console.log('[filteredTemplates] Using default order from index.json. First 5 templates:',
      templates.slice(0, 5).map(t => t.name))
  } else if (sortBy.value === 'latest') {
    templates.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateB - dateA
    })
  } else if (sortBy.value === 'oldest') {
    templates.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateA - dateB
    })
  } else if (sortBy.value === 'name') {
    templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }

  return templates
})

// Note: displayCategories and getCategoryTemplates are no longer used
// since we now always show a flat grid for proper sorting functionality
// Keeping these commented out in case we want to restore category grouping in the future

// const displayCategories = computed(() => {
//   if (selectedCategory.value !== 'all') {
//     return categories.value.filter((c: any) => c.title === selectedCategory.value)
//   }
//
//   // Filter categories that have matching templates
//   return categories.value.filter((c: any) => {
//     return getCategoryTemplates(c).length > 0
//   })
// })

// const getCategoryTemplates = (category: any) => {
//   return filteredTemplates.value.filter(t => t.categoryTitle === category.title)
// }

// Methods
const clearFilters = () => {
  selectedModel.value = 'all'
  selectedTag.value = 'all'
  selectedRunsOn.value = 'all'
  selectedDiffStatus.value = 'all'
  searchQuery.value = ''
}

const editTemplate = (template: any) => {
  if (status.value !== 'authenticated') {
    alert('Please sign in to edit templates')
    return
  }
  navigateTo(`/admin/edit/${template.name}`)
}

const viewTemplate = (template: any) => {
  // Open workflow in new tab using current repo and branch
  const repo = selectedRepo.value || 'Comfy-Org/workflow_templates'
  const branch = selectedBranch.value || 'main'
  const url = `https://github.com/${repo}/blob/${branch}/templates/${template.name}.json`
  console.log('[View Template] Opening:', url)
  window.open(url, '_blank')
}

const scrollToSidebar = () => {
  const sidebar = document.getElementById('sidebar')
  if (sidebar) {
    sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Highlight the sidebar briefly
    sidebar.classList.add('ring-2', 'ring-blue-500', 'rounded-lg')
    setTimeout(() => {
      sidebar.classList.remove('ring-2', 'ring-blue-500', 'rounded-lg')
    }, 2000)
  }
}

const dismissNotice = () => {
  noticeDismissed.value = true
}

// PR Status Management
const checkPRStatus = async () => {
  if (status.value !== 'authenticated' || !selectedRepo.value || !selectedBranch.value) {
    prStatus.value = null
    prUpdateInfo.value = null
    return
  }

  try {
    const [owner, repo] = selectedRepo.value.split('/')
    const response = await $fetch('/api/github/pr/check', {
      query: {
        owner,
        repo,
        branch: selectedBranch.value
      }
    })
    prStatus.value = response
    console.log('[PR Status]', response)

    // If PR exists and is open, check if it needs update
    if (response.hasPR && response.status === 'open' && response.prNumber) {
      await checkPRNeedsUpdate(response.prNumber)
    } else {
      prUpdateInfo.value = null
    }
  } catch (error) {
    console.error('[PR Status] Failed to check:', error)
    prStatus.value = null
    prUpdateInfo.value = null
  }
}

// Check if PR needs update (has new commits)
const checkPRNeedsUpdate = async (prNumber: number) => {
  if (!selectedRepo.value || !selectedBranch.value) {
    prUpdateInfo.value = null
    return
  }

  try {
    const [owner, repo] = selectedRepo.value.split('/')
    const response = await $fetch('/api/github/pr/needs-update', {
      query: {
        owner,
        repo,
        branch: selectedBranch.value,
        pr_number: prNumber
      }
    })
    prUpdateInfo.value = response
    console.log('[PR Needs Update]', response)
  } catch (error) {
    console.error('[PR Needs Update] Failed to check:', error)
    prUpdateInfo.value = null
  }
}

// Computed: should show "Update Branch" button
const prNeedsUpdate = computed(() => {
  return prUpdateInfo.value?.needsUpdate && prUpdateInfo.value?.comparison?.aheadBy > 0
})

// Determine if we should show "Create PR" button
const shouldShowCreatePR = computed(() => {
  if (!selectedRepo.value || !selectedBranch.value) return false

  // Don't show if on main branch
  if (selectedBranch.value === 'main') return false

  // Don't show if PR already exists (open, merged, or closed)
  if (prStatus.value && prStatus.value.hasPR) return false

  // Only show if user has write access to the current repo/branch
  if (!canEditCurrentRepo.value) return false

  // Check if there are commits to create PR from
  if (prStatus.value?.comparison?.aheadBy === 0) return false

  return true
})

const handleCreatePR = async () => {
  if (isCreatingPR.value) return

  const { data: session } = useAuth()
  const username = session.value?.user?.login

  if (!username || !selectedRepo.value || !selectedBranch.value) {
    alert('Missing required information to create PR')
    return
  }

  // Determine the target repository (main repo)
  const targetRepo = 'Comfy-Org/workflow_templates'
  const [targetOwner, targetRepoName] = targetRepo.split('/')

  // Determine the head (source branch)
  const [currentOwner, currentRepoName] = selectedRepo.value.split('/')
  const head = currentOwner === targetOwner
    ? selectedBranch.value  // Same repo, just branch name
    : `${currentOwner}:${selectedBranch.value}` // Fork, need owner:branch format

  isCreatingPR.value = true

  try {
    // Generate PR title based on diff stats
    let title = `Update templates from ${selectedBranch.value}`
    if (diffStats.value.new > 0 || diffStats.value.modified > 0) {
      const parts = []
      if (diffStats.value.new > 0) parts.push(`${diffStats.value.new} new`)
      if (diffStats.value.modified > 0) parts.push(`${diffStats.value.modified} modified`)
      if (diffStats.value.deleted > 0) parts.push(`${diffStats.value.deleted} deleted`)
      title = `Update templates: ${parts.join(', ')}`
    }

    // Generate PR body
    const body = `## Changes Summary

${diffStats.value.new > 0 ? `- ✨ **${diffStats.value.new}** new template${diffStats.value.new > 1 ? 's' : ''}` : ''}
${diffStats.value.modified > 0 ? `- ✏️ **${diffStats.value.modified}** modified template${diffStats.value.modified > 1 ? 's' : ''}` : ''}
${diffStats.value.deleted > 0 ? `- 🗑️ **${diffStats.value.deleted}** deleted template${diffStats.value.deleted > 1 ? 's' : ''}` : ''}

## Details

This PR contains updates to the ComfyUI workflow templates.

---

📝 Created via [ComfyUI Template Manager](${window.location.origin})
Branch: \`${selectedBranch.value}\`
Repository: \`${selectedRepo.value}\``

    const response = await $fetch('/api/github/pr/create', {
      method: 'POST',
      body: {
        owner: targetOwner,
        repo: targetRepoName,
        head,
        base: 'main',
        title,
        body
      }
    })

    if (response.success) {
      alert(`Pull request created successfully!\n\nPR #${response.pr.number}: ${response.pr.title}`)
      // Refresh PR status
      await checkPRStatus()
      // Open PR in new tab
      window.open(response.pr.url, '_blank')
    } else {
      alert(`Failed to create PR: ${response.message}`)
    }
  } catch (error: any) {
    console.error('[Create PR] Error:', error)
    const message = error.data?.message || error.message || 'Failed to create pull request'
    alert(`Error: ${message}`)
  } finally {
    isCreatingPR.value = false
  }
}

// Handle Update Branch (pull new commits from PR)
const handleUpdateBranch = async () => {
  if (isUpdatingBranch.value || !prUpdateInfo.value?.prHeadSha) return

  if (!selectedRepo.value || !selectedBranch.value) {
    alert('Missing repository or branch information')
    return
  }

  const commitCount = prUpdateInfo.value.comparison?.aheadBy || 0
  const confirmed = confirm(
    `This will update your local branch with ${commitCount} new commit${commitCount !== 1 ? 's' : ''} from the PR.\n\n` +
    `Are you sure you want to continue?`
  )

  if (!confirmed) return

  isUpdatingBranch.value = true

  try {
    const [owner, repo] = selectedRepo.value.split('/')

    const response = await $fetch('/api/github/branch/update-from-pr', {
      method: 'POST',
      body: {
        owner,
        repo,
        branch: selectedBranch.value,
        targetSha: prUpdateInfo.value.prHeadSha
      }
    })

    if (response.success) {
      alert(`Branch updated successfully!\n\nYour branch is now up to date with the PR.`)

      // Refresh templates and PR status
      if (selectedRepo.value && selectedBranch.value) {
        const [owner, name] = selectedRepo.value.split('/')
        clearCache(owner, name, selectedBranch.value)
        // Fetch latest commit SHA for stronger CDN cache busting
        const sha = await fetchLatestCommitSha(owner, name, selectedBranch.value)
        if (sha) {
          latestCommitSha.value = sha
          cacheBustTimestamp.value = Date.now()
          console.log('[Update Branch] Using commit SHA for cache bust:', sha.substring(0, 8))
        } else {
          cacheBustTimestamp.value = Date.now()
        }
        await loadTemplates(owner, name, selectedBranch.value, true)
      }
      await checkPRStatus()
    }
  } catch (error: any) {
    console.error('[Update Branch] Error:', error)
    const message = error.data?.message || error.message || 'Failed to update branch'
    alert(`Error: ${message}\n\nThis might happen if there are conflicts. Please update your branch manually on GitHub.`)
  } finally {
    isUpdatingBranch.value = false
  }
}

const handleSwitchToPRBranch = async (pr: any) => {
  console.log('[Switch Branch] Switching to PR branch:', pr)

  // Determine the repository (might be a fork)
  const targetRepo = pr.head.repo
    ? pr.head.repo.full_name
    : 'Comfy-Org/workflow_templates' // Fallback if no head.repo

  const targetBranch = pr.head.ref

  console.log('[Switch Branch] Target:', { repo: targetRepo, branch: targetBranch })

  // Mark that we're viewing a PR branch (browsing mode)
  viewingPRBranch.value = `${targetRepo}/${targetBranch}`
  prNoticeDismissed.value = false // Show the notice again when switching to PR

  // Update selected repo and branch
  selectedRepo.value = targetRepo
  selectedBranch.value = targetBranch

  // The watch on [selectedRepo, selectedBranch] will automatically trigger loadTemplates
  // But we can also explicitly load to ensure it happens
  const [owner, name] = targetRepo.split('/')
  await loadTemplates(owner, name, targetBranch)

  // Check PR status after switching
  if (status.value === 'authenticated') {
    await checkPRStatus()
  }
}

// Reset notice when user gains write access to repository
watch(hasRepoWriteAccess, (hasAccess) => {
  if (hasAccess) {
    noticeDismissed.value = false
  }
})

// Watch for repo/branch changes to check PR status
watch([selectedRepo, selectedBranch], async () => {
  if (isMounted.value && status.value === 'authenticated') {
    await checkPRStatus()
  }
}, { immediate: false })

useHead({
  title: 'ComfyUI Templates - Browse & Manage'
})
</script>
