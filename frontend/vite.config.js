import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3006,
    open: true,
    fs: {
      strict: false,
    },
  },
  resolve: {
    alias: {
      //'@': path.resolve(__dirname, 'src'),
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config') // If using config folder
    },
    extensions: ['.js', '.jsx', '.json']  // Add this line
  },
  base: process.env.VITE_BASE_PATH || "/VivaQ",
})
