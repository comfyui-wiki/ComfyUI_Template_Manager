<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">Repository & Branch</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Repository Selector -->
      <div>
        <label class="text-sm font-medium mb-2 block">Repository</label>
        <Select v-model="selectedRepo" @update:modelValue="onRepoChange">
          <SelectTrigger :disabled="availableRepos.length === 0">
            <SelectValue placeholder="Select repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="repo in availableRepos"
              :key="repo.fullName"
              :value="repo.fullName"
            >
              <div class="flex items-center gap-2">
                <svg v-if="repo.type === 'main'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span class="text-sm">{{ repo.label }}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Fork prompt if no fork exists -->
        <div v-if="!hasFork" class="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <p class="text-blue-800 mb-2">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ hasMainRepoAccess
              ? 'Create a fork for experimental changes or independent work'
              : 'Fork the repository to contribute templates' }}
          </p>
          <div class="flex gap-2">
            <Button @click="handleCreateFork" size="sm" class="flex-1" :disabled="isLoading">
              <svg v-if="!isLoading" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span v-if="isLoading">Creating...</span>
              <span v-else>Create Fork</span>
            </Button>
            <Button @click="handleRecheckFork" size="sm" variant="outline" :disabled="isLoading">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>
        </div>

        <!-- Fork outdated warning - Only show when current repo IS the fork -->
        <div v-if="isCurrentRepoFork && forkCompareStatus?.isBehind" class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p class="text-yellow-800 mb-2 font-medium flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Fork is {{ forkCompareStatus.behindBy }} commit{{ forkCompareStatus.behindBy > 1 ? 's' : '' }} behind
          </p>
          <p class="text-yellow-700 text-xs mb-2">
            Your fork is outdated. Sync to get the latest templates from upstream.
          </p>

          <!-- Show different options based on whether fork is also ahead -->
          <div v-if="forkCompareStatus.isAhead" class="space-y-2">
            <p class="text-orange-700 text-xs font-medium flex items-center gap-1 mb-2">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Diverged: {{ forkCompareStatus.aheadBy }} ahead, {{ forkCompareStatus.behindBy }} behind
            </p>

            <!-- Main Sync Button -->
            <Button
              @click="handleSyncFork"
              size="sm"
              class="w-full"
              :disabled="isLoading"
              variant="default"
            >
              <svg v-if="!isLoading" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span v-if="isLoading">Syncing...</span>
              <span v-else>Try Merge Sync</span>
            </Button>

            <!-- Advanced Options (Collapsible) -->
            <div class="pt-1">
              <button
                @click="showAdvancedSyncOptions = !showAdvancedSyncOptions"
                class="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors w-full justify-center"
              >
                <svg
                  class="w-3 h-3 transition-transform"
                  :class="{ 'rotate-180': showAdvancedSyncOptions }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
                <span>Advanced Options</span>
              </button>

              <div v-if="showAdvancedSyncOptions" class="mt-2 space-y-1.5">
                <!-- Option 1: Save to branch and reset -->
                <Button
                  @click="handleShowSaveReset"
                  size="sm"
                  class="w-full text-xs h-8"
                  :disabled="isLoading || isResetting"
                  variant="outline"
                  title="Save your changes to a new branch, then reset main to upstream"
                >
                  <svg v-if="isResetting && resetOperation === 'save'" class="w-3 h-3 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 12h12m-12 5h12m-6-9v12" />
                  </svg>
                  <span v-if="isResetting && resetOperation === 'save'">Processing...</span>
                  <span v-else>Save & Reset</span>
                </Button>

                <!-- Option 2: Force reset -->
                <Button
                  @click="handleShowForceReset"
                  size="sm"
                  class="w-full text-xs h-8"
                  :disabled="isLoading || isResetting"
                  variant="destructive"
                  title="Permanently discard your changes and force reset to upstream (CANNOT BE UNDONE)"
                >
                  <svg v-if="isResetting && resetOperation === 'force'" class="w-3 h-3 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span v-if="isResetting && resetOperation === 'force'">Resetting...</span>
                  <span v-else>Force Reset</span>
                </Button>
              </div>
            </div>
          </div>

          <!-- Simple sync button if only behind (not ahead) -->
          <Button
            v-else
            @click="handleSyncFork"
            size="sm"
            class="w-full"
            :disabled="isLoading"
          >
            <svg v-if="!isLoading" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-if="isLoading">Syncing...</span>
            <span v-else>Sync Fork</span>
          </Button>
        </div>

        <!-- Fork up to date notice - Only show when current repo IS the fork -->
        <div v-if="isCurrentRepoFork && forkCompareStatus && !forkCompareStatus.isBehind && !forkCompareStatus.isAhead" class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
          <p class="text-green-700 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fork is up to date with upstream
          </p>
        </div>
      </div>

      <!-- Branch Selector -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-medium">Branch</label>
          <Button
            variant="ghost"
            size="sm"
            @click="showCreateBranch = true"
            :disabled="!hasRepoWriteAccess || isLoading"
            :title="hasRepoWriteAccess ? 'Create a new branch' : 'You need write access to create branches'"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New
          </Button>
        </div>

        <Select v-model="selectedBranch" @update:modelValue="onBranchChange" :disabled="branches.length === 0 || isLoading">
          <SelectTrigger>
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="branch in branches" :key="branch.name" :value="branch.name">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span class="font-mono text-sm">{{ branch.name }}</span>
                <span v-if="branch.isDefault" class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  default
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Current working branch info -->
        <div v-if="selectedBranch" class="mt-2 p-2 bg-muted rounded text-xs">
          <div class="flex items-center gap-2">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Working on: <span class="font-mono font-semibold">{{ selectedBranch }}</span></span>
          </div>

          <!-- Branch upstream comparison -->
          <div v-if="currentBranchComparison" class="mt-1 flex items-center gap-1 text-muted-foreground">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span v-if="currentBranchComparison.aheadBy > 0 && currentBranchComparison.behindBy > 0" class="text-yellow-600">
              {{ currentBranchComparison.aheadBy }} ahead, {{ currentBranchComparison.behindBy }} behind upstream
            </span>
            <span v-else-if="currentBranchComparison.aheadBy > 0" class="text-blue-600">
              {{ currentBranchComparison.aheadBy }} commit{{ currentBranchComparison.aheadBy !== 1 ? 's' : '' }} ahead of upstream
            </span>
            <span v-else-if="currentBranchComparison.behindBy > 0" class="text-orange-600">
              {{ currentBranchComparison.behindBy }} commit{{ currentBranchComparison.behindBy !== 1 ? 's' : '' }} behind upstream
            </span>
            <span v-else class="text-green-600">
              Up to date with upstream
            </span>
          </div>

          <!-- Permission status -->
          <div v-if="canEditCurrentRepo" class="text-green-600 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Can edit this branch</span>
          </div>
          <div v-else-if="branchPermission?.isProtected" class="text-yellow-600 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Branch protected (use PR)</span>
          </div>
          <div v-else class="text-red-600 mt-1 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Read-only: No edit permission</span>
          </div>

          <!-- Best practice warning: Don't work on fork's main branch -->
          <div v-if="isWorkingOnForkMainBranch" class="mt-2 pt-2 border-t border-gray-300">
            <div class="text-orange-600 flex items-start gap-1">
              <svg class="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p class="font-medium">Best Practice</p>
                <p class="text-[11px] leading-tight mt-0.5">
                  Create a new branch instead of committing to main. This keeps your fork's main branch clean for syncing.
                </p>
                <Button
                  @click="showCreateBranch = true"
                  size="sm"
                  variant="outline"
                  class="mt-1.5 h-6 text-[11px] px-2"
                >
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create New Branch
                </Button>
              </div>
            </div>
          </div>

          <!-- Manage Branches (collapsible) -->
          <div v-if="hasRepoWriteAccess && branches.length > 1" class="mt-2 pt-2 border-t text-xs">
            <button
              @click="showManageBranches = !showManageBranches"
              class="flex items-center gap-1 w-full hover:opacity-80 transition-opacity font-medium"
            >
              <svg
                class="w-3 h-3 transition-transform"
                :class="{ 'rotate-90': showManageBranches }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              <span>Manage Branches</span>
            </button>
            <div v-if="showManageBranches" class="mt-2 space-y-1">
              <div
                v-for="branch in branches"
                :key="branch.name"
                class="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 group"
              >
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                  </svg>
                  <code class="font-mono text-xs truncate">{{ branch.name }}</code>
                  <span v-if="branch.isDefault" class="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded flex-shrink-0">
                    default
                  </span>
                </div>
                <Button
                  v-if="!branch.isDefault"
                  @click="handleDeleteBranch(branch.name)"
                  size="sm"
                  variant="ghost"
                  class="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  :disabled="deletingBranch === branch.name"
                  :title="`Delete branch ${branch.name}`"
                >
                  <svg v-if="deletingBranch === branch.name" class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="w-3 h-3 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>

          <!-- Debug permission info (collapsible) -->
          <div v-if="true" class="mt-2 pt-2 border-t text-xs opacity-60">
            <button
              @click="showDebugInfo = !showDebugInfo"
              class="flex items-center gap-1 w-full hover:opacity-80 transition-opacity"
            >
              <svg
                class="w-3 h-3 transition-transform"
                :class="{ 'rotate-90': showDebugInfo }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              <strong>Debug Info</strong>
            </button>
            <div v-if="showDebugInfo" class="mt-1 space-y-1 pl-4">
              <div>Selected repo: {{ selectedRepo }}</div>
              <div>Selected branch: {{ selectedBranch }}</div>
              <div>Branches loaded: {{ branches.length }}</div>
              <div v-if="branches.length > 0">Branch names: {{ branches.map(b => b.name).join(', ') }}</div>
              <div>Has fork: {{ hasFork }}</div>
              <div>Has main access: {{ hasMainRepoAccess }}</div>
              <div>Available repos: {{ availableRepos.length }}</div>
              <div>Repo write access: {{ hasRepoWriteAccess }}</div>
              <div v-if="forkCompareStatus">
                <div>Fork behind: {{ forkCompareStatus.behindBy || 0 }}</div>
                <div>Fork ahead: {{ forkCompareStatus.aheadBy || 0 }}</div>
                <div>Fork status: {{ forkCompareStatus.status }}</div>
              </div>
              <div v-if="branchPermission">
                <div>Permission: {{ branchPermission.permission }}</div>
                <div v-if="branchPermission.isProtected !== undefined">Protected: {{ branchPermission.isProtected }}</div>
                <div>Can push: {{ branchPermission.canPush }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- Create Branch Dialog -->
  <Dialog v-model:open="showCreateBranch">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New Branch</DialogTitle>
        <DialogDescription>
          Create a new branch from {{ selectedBranch || 'main' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium mb-2 block">Branch Name</label>
          <Input
            v-model="newBranchName"
            :placeholder="suggestedBranchName"
            class="font-mono"
          />
          <div class="mt-1 space-y-1">
            <p v-if="!hasUserInput" class="text-xs text-muted-foreground">
              Leave empty to use: <code class="font-mono">{{ suggestedBranchName }}</code>
            </p>
            <p v-else-if="!sanitizedBranchName" class="text-xs text-red-600">
              ✗ Invalid branch name (contains only invalid characters)
            </p>
            <p v-else-if="needsConversion" class="text-xs">
              <span class="text-orange-600">Will be converted to: </span>
              <code class="font-mono font-semibold text-blue-600">{{ sanitizedBranchName }}</code>
            </p>
            <p v-else class="text-xs text-green-600">
              ✓ Valid branch name
            </p>
          </div>
        </div>

        <div class="flex gap-2">
          <Button
            @click="handleCreateBranch"
            class="flex-1"
            :disabled="isLoading || (hasUserInput && !sanitizedBranchName)"
          >
            <span v-if="isLoading">Creating...</span>
            <span v-else>Create Branch</span>
          </Button>
          <Button @click="showCreateBranch = false" variant="outline">Cancel</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Reset Main Branch Dialogs -->
  <ResetMainDialog
    ref="resetMainDialog"
    :ahead-by="forkCompareStatus?.aheadBy || 0"
    :suggested-branch-name="suggestedResetBranchName"
    :fork-owner="forkOwner"
    :fork-repo="forkRepo"
    @create-backup="handleCreateBackup"
    @refresh="handleRefreshAfterSync"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ResetMainDialog from '@/components/ResetMainDialog.vue'

const {
  hasMainRepoAccess,
  hasFork,
  selectedRepo,
  selectedBranch,
  branches,
  isLoading,
  availableRepos,
  hasRepoWriteAccess,
  canEditCurrentRepo,
  branchPermission,
  forkCompareStatus,
  createFork,
  syncFork,
  loadBranches,
  createBranch,
  initialize
} = useGitHubRepo()

const showCreateBranch = ref(false)
const newBranchName = ref('')
const showDebugInfo = ref(false) // Collapsed by default
const showManageBranches = ref(false)
const deletingBranch = ref<string | null>(null)
const currentBranchComparison = ref<any>(null)
const showAdvancedSyncOptions = ref(true) // Default to expanded
const resetMainDialog = ref<InstanceType<typeof ResetMainDialog> | null>(null)
const isResetting = ref(false)
const resetOperation = ref<'save' | 'force' | null>(null)

const suggestedBranchName = computed(() => {
  const now = new Date()
  // Format: YYYYMMDD-HHmmss (e.g., 20260117-143052)
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 19).replace(/:/g, '')
  return `template-update-${date}-${time}`
})

const suggestedResetBranchName = computed(() => {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 19).replace(/:/g, '')
  return `backup-main-${date}-${time}`
})

const forkOwner = computed(() => {
  const { data: session } = useAuth()
  return session.value?.user?.login || ''
})

const forkRepo = computed(() => {
  const config = useRuntimeConfig()
  return config.public.repoName
})

// Sanitize branch name to follow Git branch naming rules
const sanitizeBranchName = (name: string): string => {
  if (!name) return ''

  return name
    .trim()
    // Convert to lowercase
    .toLowerCase()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace multiple consecutive hyphens/underscores with single hyphen
    .replace(/[-_]+/g, '-')
    // Remove invalid characters: ~, ^, :, ?, *, [, \, @{, etc.
    .replace(/[~^:?*[\]\\@{}<>|"'`]/g, '')
    // Remove dots at the beginning or end
    .replace(/^\.+|\.+$/g, '')
    // Remove consecutive dots
    .replace(/\.{2,}/g, '.')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Remove slashes at the end
    .replace(/\/+$/g, '')
    // Ensure it doesn't end with .lock
    .replace(/\.lock$/i, '')
}

const sanitizedBranchName = computed(() => {
  return sanitizeBranchName(newBranchName.value)
})

// Check if user has actually entered something (after trim)
const hasUserInput = computed(() => {
  return newBranchName.value.trim().length > 0
})

// Check if sanitization will change the input
const needsConversion = computed(() => {
  if (!hasUserInput.value) return false
  const trimmed = newBranchName.value.trim()
  return sanitizedBranchName.value !== trimmed
})

// Check if currently selected repo is the user's fork
const isCurrentRepoFork = computed(() => {
  if (!selectedRepo.value || !hasFork.value) return false

  const currentRepo = availableRepos.value.find(r => r.fullName === selectedRepo.value)
  return currentRepo?.type === 'fork'
})

// Check if user is working on their fork's main branch (not recommended)
const isWorkingOnForkMainBranch = computed(() => {
  if (!selectedRepo.value || !selectedBranch.value) return false

  const [owner] = selectedRepo.value.split('/')
  const { data: session } = useAuth()

  // Check if:
  // 1. Current repo is user's fork (owner matches username)
  // 2. Current branch is 'main'
  const isOwnFork = owner === session.value?.user?.login
  const isMainBranch = selectedBranch.value === 'main'

  return isOwnFork && isMainBranch
})

const onRepoChange = async () => {
  if (!selectedRepo.value) return
  const [owner, name] = selectedRepo.value.split('/')

  // Save current branch before loading new branches
  const previousBranch = selectedBranch.value

  await loadBranches(owner, name)

  // Try to keep the same branch name if it exists in the new repo
  const branchExists = branches.value.find(b => b.name === previousBranch)
  if (branchExists) {
    console.log('[RepoAndBranchSwitcher] Keeping branch:', previousBranch)
    selectedBranch.value = previousBranch
  } else {
    console.log('[RepoAndBranchSwitcher] Branch not found, switching to main')
    selectedBranch.value = 'main'
  }
}

const onBranchChange = (newBranch: string) => {
  console.log('[RepoAndBranchSwitcher] Branch changed to:', newBranch)
  console.log('[RepoAndBranchSwitcher] Current repo:', selectedRepo.value)
}

// Debug watcher for selectedBranch
watch(selectedBranch, (newVal, oldVal) => {
  console.log('[RepoAndBranchSwitcher] selectedBranch watch:', { old: oldVal, new: newVal })
})

// Debug watcher for branches array
watch(branches, (newVal) => {
  console.log('[RepoAndBranchSwitcher] branches watch:', {
    count: newVal.length,
    names: newVal.map(b => b.name),
    selectedBranch: selectedBranch.value
  })
})

const handleCreateFork = async () => {
  try {
    await createFork()
    // Re-initialize to refresh available repos
    await initialize()
  } catch (error) {
    console.error('Failed to create fork:', error)
    alert('Failed to create fork. Please try again.')
  }
}

const handleRecheckFork = async () => {
  console.log('[RepoAndBranchSwitcher] Manual recheck fork triggered')
  try {
    await initialize()
    console.log('[RepoAndBranchSwitcher] Recheck complete. Has fork:', hasFork.value)
  } catch (error) {
    console.error('[RepoAndBranchSwitcher] Failed to recheck fork:', error)
  }
}

const handleCreateBranch = async () => {
  // Use sanitized branch name or suggested name
  const inputName = newBranchName.value.trim()
  const branchName = inputName
    ? sanitizeBranchName(inputName)
    : suggestedBranchName.value

  // Validate that we have a valid branch name after sanitization
  if (!branchName) {
    alert('Please enter a valid branch name')
    return
  }

  const [owner, name] = selectedRepo.value.split('/')

  try {
    await createBranch(owner, name, branchName, selectedBranch.value)
    selectedBranch.value = branchName
    showCreateBranch.value = false
    newBranchName.value = ''
    // Load comparison for the new branch
    await loadCurrentBranchComparison()
  } catch (error) {
    console.error('Failed to create branch:', error)
    alert('Failed to create branch. Please try again.')
  }
}

const handleSyncFork = async () => {
  try {
    const result = await syncFork()
    if (result.success) {
      if (result.alreadyUpToDate) {
        alert('Fork is already up to date!')
      } else {
        alert('Fork synced successfully! Refreshing...')
        // Refresh the page to load updated templates
        await initialize()
        // Refresh branch comparison
        await loadCurrentBranchComparison()
        window.location.reload()
      }
    } else if (result.needsManualMerge) {
      alert('Your fork has diverged from upstream. Please merge manually on GitHub.')
      window.open(`https://github.com/${selectedRepo.value}`, '_blank')
    } else {
      alert(`Failed to sync fork: ${result.error}`)
    }
  } catch (error) {
    console.error('Failed to sync fork:', error)
    alert('Failed to sync fork. Please try again.')
  }
}

// Show save & reset dialog
const handleShowSaveReset = () => {
  resetMainDialog.value?.showSaveReset()
}

// Show force reset dialog
const handleShowForceReset = () => {
  resetMainDialog.value?.showForceReset()
}

// Handle create backup branch only
const handleCreateBackup = async (branchName: string) => {
  isResetting.value = true
  resetOperation.value = 'save'

  try {
    const [owner, name] = selectedRepo.value.split('/')

    const response = await $fetch('/api/github/branch/create', {
      method: 'POST',
      body: {
        owner,
        repo: name,
        branch: branchName,
        from: 'main'
      }
    })

    if (response.success) {
      // Show GitHub sync guide
      resetMainDialog.value?.showSuccess(branchName)
      isResetting.value = false
      resetOperation.value = null
    } else {
      resetMainDialog.value?.showError('Failed to create backup branch')
      isResetting.value = false
      resetOperation.value = null
    }
  } catch (error: any) {
    console.error('Failed to create backup branch:', error)
    const errorMsg = error.data?.message || error.message || 'Failed to create backup branch'
    resetMainDialog.value?.showError(errorMsg)
    isResetting.value = false
    resetOperation.value = null
  }
}

// Handle refresh after user syncs on GitHub
const handleRefreshAfterSync = async () => {
  await initialize()
  await loadCurrentBranchComparison()
}

// Delete a branch
const handleDeleteBranch = async (branchName: string) => {
  if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) {
    return
  }

  deletingBranch.value = branchName

  try {
    const response = await $fetch('/api/github/fork/branch', {
      method: 'DELETE',
      body: {
        branch: branchName
      }
    })

    if (response.success) {
      // Reload branches
      const [owner, name] = selectedRepo.value.split('/')
      await loadBranches(owner, name)

      alert(`Branch "${branchName}" deleted successfully`)
    } else {
      alert(`Failed to delete branch: ${response.error}`)
    }
  } catch (error: any) {
    console.error('Failed to delete branch:', error)
    alert(`Failed to delete branch: ${error.message || 'Unknown error'}`)
  } finally {
    deletingBranch.value = null
  }
}

// Compare current branch with upstream
const loadCurrentBranchComparison = async () => {
  if (!selectedRepo.value || !selectedBranch.value) {
    currentBranchComparison.value = null
    return
  }

  // Only show comparison for non-upstream repos (forks)
  const [owner, repo] = selectedRepo.value.split('/')
  const config = useRuntimeConfig()
  if (owner === config.public.repoOwner) {
    // This is the upstream repo, no need to compare
    currentBranchComparison.value = null
    return
  }

  try {
    const response = await $fetch('/api/github/branch/compare-upstream', {
      query: {
        owner,
        repo,
        branch: selectedBranch.value
      }
    })

    if (response.success) {
      currentBranchComparison.value = response
    } else {
      currentBranchComparison.value = null
    }
  } catch (error) {
    console.error('Failed to load branch comparison:', error)
    currentBranchComparison.value = null
  }
}

// Watch for branch/repo changes to load comparison
watch([selectedRepo, selectedBranch], async () => {
  await loadCurrentBranchComparison()
}, { immediate: false })

// Initialize on mount
onMounted(() => {
  initialize()
  // Load comparison after initialization
  setTimeout(() => {
    loadCurrentBranchComparison()
  }, 1000)
})
</script>
