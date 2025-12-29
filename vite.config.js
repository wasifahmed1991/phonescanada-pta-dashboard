import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT for GitHub Pages project sites:
// https://<username>.github.io/<repo>/
export default defineConfig({
  plugins: [react()],
  base: '/phonescanada-pta-dashboard/',
})
