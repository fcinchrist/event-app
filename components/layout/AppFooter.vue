<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <footer class="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
    <div class="max-w-7xl mx-auto px-4">
      <p class="font-semibold text-slate-600">{{ config.public.companyName }} Events &copy; 2026</p>
      <p class="mt-1">Sistem Reservasi & Absensi Instan Berbasis Client-Side Local Storage</p>
    </div>
  </footer>
</template>
