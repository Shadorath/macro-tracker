import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The app is served from https://shadorath.github.io/macro-tracker/,
// so every file path starts with /macro-tracker/.
export default defineConfig({
  base: '/macro-tracker/',
  plugins: [preact()],
});
