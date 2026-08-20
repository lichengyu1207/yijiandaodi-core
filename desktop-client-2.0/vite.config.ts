/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          // 沙箱限制默认 AppData 创建锁文件，通过 --user-data-dir 绕过。
          // 注意 startup(argv) 会整体覆盖默认 ['--no-sandbox']，必须显式带上 app 路径 '.'。
          options.startup(['.', '--no-sandbox', '--user-data-dir=' + path.resolve(__dirname, '.electron-dev-userdata')])
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        xiaojian: resolve(__dirname, 'xiaojian.html'),
      },
    },
  },
})