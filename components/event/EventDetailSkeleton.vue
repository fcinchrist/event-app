<script setup lang="ts">
/**
 * Skeleton untuk halaman detail event.
 * Meniru layout: gambar besar + info di kolom kiri, peserta di bawahnya,
 * form booking di sidebar kanan. Dipakai saat pertama load / refresh /
 * deep-link sebelum data event + peserta siap.
 */
</script>

<template>
  <div class="space-y-8">
    <!-- Back link placeholder -->
    <UiSkeletonBlock width="w-32" height="h-4" rounded="rounded-md" />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <!-- Main content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Event info card -->
        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <!-- Hero image -->
          <UiSkeletonBlock height="h-64 sm:h-80" rounded="rounded-none" />

          <div class="p-6 sm:p-8 space-y-4">
            <!-- Title -->
            <UiSkeletonBlock width="w-3/4" height="h-8" rounded="rounded-lg" />
            <UiSkeletonBlock width="w-1/2" height="h-3" rounded="rounded-md" />

            <!-- Meta info: 2 columns -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 my-2 border-y border-slate-100">
              <div class="flex items-center gap-3">
                <UiSkeletonBlock width="w-9" height="h-9" rounded="rounded-xl" />
                <div class="flex-grow space-y-1.5">
                  <UiSkeletonBlock width="w-24" height="h-2" rounded="rounded-md" />
                  <UiSkeletonBlock width="w-36" height="h-3" rounded="rounded-md" />
                </div>
              </div>
              <div class="flex items-center gap-3">
                <UiSkeletonBlock width="w-9" height="h-9" rounded="rounded-xl" />
                <div class="flex-grow space-y-1.5">
                  <UiSkeletonBlock width="w-24" height="h-2" rounded="rounded-md" />
                  <UiSkeletonBlock width="w-28" height="h-3" rounded="rounded-md" />
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-2 pt-2">
              <UiSkeletonBlock width="w-32" height="h-3" rounded="rounded-md" />
              <UiSkeletonBlock width="w-full" height="h-3" rounded="rounded-md" />
              <UiSkeletonBlock width="w-full" height="h-3" rounded="rounded-md" />
              <UiSkeletonBlock width="w-2/3" height="h-3" rounded="rounded-md" />
            </div>
          </div>
        </div>

        <!-- Participants list skeleton -->
        <AttendanceRegistrationListSkeleton :rows="3" />
      </div>

      <!-- Sidebar: booking form skeleton -->
      <div class="space-y-6 lg:sticky lg:top-24">
        <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div class="space-y-2">
            <UiSkeletonBlock width="w-1/2" height="h-5" rounded="rounded-md" />
            <UiSkeletonBlock width="w-full" height="h-2.5" rounded="rounded-md" />
          </div>

          <!-- Quota bar -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <UiSkeletonBlock width="w-20" height="h-2.5" rounded="rounded-md" />
              <UiSkeletonBlock width="w-12" height="h-2.5" rounded="rounded-md" />
            </div>
            <UiSkeletonBlock width="w-full" height="h-1.5" rounded="rounded-full" />
          </div>

          <!-- Form fields -->
          <div class="space-y-3.5">
            <div class="space-y-1.5">
              <UiSkeletonBlock width="w-28" height="h-2.5" rounded="rounded-md" />
              <UiSkeletonBlock width="w-full" height="h-10" rounded="rounded-xl" />
            </div>
            <div class="space-y-1.5">
              <UiSkeletonBlock width="w-28" height="h-2.5" rounded="rounded-md" />
              <UiSkeletonBlock width="w-full" height="h-10" rounded="rounded-xl" />
            </div>
            <UiSkeletonBlock width="w-full" height="h-12" rounded="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
