//import adapter from '@sveltejs/adapter-auto';
import adapter from '@sveltejs/adapter-node';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    csrf: { checkOrigin: true },
    alias: {
      $components: './src/components',
      $lib: './src/lib',
      $stores: './src/stores',
      $util: './src/util',
      $ext: './src/lib/ext',
      $server: './src/lib/server'
    }
  },
  preprocess: [
    preprocess({
      postcss: true
    })
  ]
};

export default config;
