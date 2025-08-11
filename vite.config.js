import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/letterboxd-elo/' // <-- replace REPO_NAME with your GitHub repo name and keep the trailing slash
})
