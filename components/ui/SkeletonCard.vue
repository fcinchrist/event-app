<template>
  <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
    <div>
      <!-- Image Skeleton -->
      <div class="h-48 bg-slate-100 relative overflow-hidden">
        <div class="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
        <div class="absolute top-3 left-3">
          <div class="h-5 w-24 bg-slate-300/60 rounded-lg animate-pulse" />
        </div>
        <div class="absolute top-3 right-3">
          <div class="h-6 w-20 bg-slate-300/60 rounded-xl animate-pulse" />
        </div>
      </div>
      <!-- Content Skeleton -->
      <div class="p-5 space-y-3">
        <div class="h-5 w-3/4 bg-slate-200 rounded-lg animate-pulse" />
        <div class="flex items-center gap-1.5">
          <div class="h-3.5 w-3.5 bg-slate-200 rounded animate-pulse" />
          <div class="h-3 w-36 bg-slate-200 rounded animate-pulse" />
        </div>
        <div class="flex items-center gap-1.5">
          <div class="h-3.5 w-3.5 bg-slate-200 rounded animate-pulse" />
          <div class="h-3 w-28 bg-slate-200 rounded animate-pulse" />
        </div>
        <div class="space-y-1.5 pt-1">
          <div class="h-3.5 w-full bg-slate-200 rounded animate-pulse" />
          <div class="h-3.5 w-2/3 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
    <!-- Button Skeleton -->
    <div class="p-5 pt-0">
      <div class="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
    </div>
  </div>
</template>
