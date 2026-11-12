import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      'zustand',
      'react',
      'react-dom/client',
      '@react-three/drei > three-stdlib',
      '@react-three/drei > @babel/runtime/helpers/esm/extends',
    ],
    // En Windows el antivirus borraba el archivo pre-empaquetado de drei (3,7 MB) de
    // node_modules/.vite y el servidor de desarrollo respondía 504. drei se importa
    // de a un componente (src/escena/drei.ts) y se sirve sin pre-empaquetar.
    // No afecta al build de producción.
    exclude: ['@react-three/drei'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
