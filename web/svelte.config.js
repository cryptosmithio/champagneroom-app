//import adapter from '@sveltejs/adapter-auto';
import adapter from '@sveltejs/adapter-node';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    csrf: { checkOrigin: false },
    alias: { $components: './src/components' },
  },
  preprocess: [
    preprocess({
      postcss: true,
    }),
  ],
};

export default config;
