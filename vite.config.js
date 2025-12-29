import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/phonescanada-pta-dashboard/', // 🔥 REQUIRED for GitHub Pages
})
