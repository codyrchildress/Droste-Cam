import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  base: '/Droste-Cam/',
  server: {
    open: true,
  },
});
