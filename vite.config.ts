import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'CADStudio 3D Viewer',
          short_name: 'CADStudio 3D',
          description: 'Professional 3D CAD & Mesh Viewer supporting GLB, STL, STEP, 3MF, OBJ, and ZIP files.',
          theme_color: '#090d16',
          background_color: '#090d16',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          file_handlers: [
            {
              action: '/',
              accept: {
                'model/gltf-binary': ['.glb'],
                'model/gltf+json': ['.gltf'],
                'model/stl': ['.stl'],
                'application/sla': ['.stl'],
                'application/vnd.ms-pki.stl': ['.stl'],
                'model/step': ['.step', '.stp'],
                'application/step': ['.step', '.stp'],
                'model/3mf': ['.3mf'],
                'application/vnd.ms-package.3dmanufacturing-3dmodel+xml': ['.3mf'],
                'model/obj': ['.obj'],
                'application/zip': ['.zip'],
              },
            },
          ],
          share_target: {
            action: '/share-target',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              files: [
                {
                  name: 'file',
                  accept: [
                    'model/gltf-binary',
                    '.glb',
                    'model/gltf+json',
                    '.gltf',
                    'model/stl',
                    'application/sla',
                    'application/vnd.ms-pki.stl',
                    '.stl',
                    'model/step',
                    'application/step',
                    '.step',
                    '.stp',
                    'model/3mf',
                    '.3mf',
                    'model/obj',
                    '.obj',
                    'application/zip',
                    '.zip',
                  ],
                },
              ],
            },
          },
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          importScripts: ['/sw-share.js'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
