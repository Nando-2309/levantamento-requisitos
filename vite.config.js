import { defineConfig } from 'vite';

export default defineConfig({
  base: '/levantamento-requisitos/',
  server: {
    watch: {
      ignored: ['**/dist/**', '**/tmp/**'],
    },
  },
});
