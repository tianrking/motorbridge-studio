import { defineConfig } from 'vite';
const UI_PORT = Number.parseInt(process.env.VITE_FACTORY_UI_PORT || '18110', 10) || 18110;

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: UI_PORT,
  },
  preview: {
    host: '0.0.0.0',
    port: UI_PORT,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three-core',
              test: /node_modules[\\/]three[\\/]build[\\/]/,
              priority: 30,
            },
            {
              name: 'three-addons',
              test: /node_modules[\\/]three[\\/]examples[\\/]/,
              priority: 20,
            },
            {
              name: 'urdf-loader',
              test: /node_modules[\\/]urdf-loader[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
