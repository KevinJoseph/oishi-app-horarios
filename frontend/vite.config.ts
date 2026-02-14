import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.VITE_DEV_API_TARGET ?? 'http://localhost:4602';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true
        }
      }
    }
  };
});
