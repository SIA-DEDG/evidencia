import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { dashboardApiPlugin } from './server/dashboardApiPlugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), dashboardApiPlugin(env.SUPABASE_URL)],
  }
})
