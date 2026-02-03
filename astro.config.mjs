// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://tobiasfu.com',
  integrations: [react()],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
});
