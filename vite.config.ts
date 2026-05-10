import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const appBasePath = env.VITE_APP_BASE_PATH?.trim() || './';
  return {
    base: appBasePath,
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        cookie: path.resolve(__dirname, 'src/lib/cookie-shim.ts'),
        'firebase/firestore': path.resolve(__dirname, 'src/lib/firestore-shim.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['recharts', 'motion', 'react-router-dom', 'date-fns', 'lucide-react'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
