import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
import EnvironmentPlugin from 'vite-plugin-environment';
import nodePolyfills from 'vite-plugin-node-stdlib-browser';
import mkcert from 'vite-plugin-mkcert';

const config: UserConfig = {
  mode: 'development',
  plugins: [
    sveltekit(),
    mkcert(),
    EnvironmentPlugin(['MONGO_DB_FIELD_SECRET']),
    nodePolyfills({
      protocolImports: true
    })
  ],
  resolve: {
    alias: {}
  },
  build: {
    chunkSizeWarningLimit: 16000,
    rollupOptions: {
      external: ['@web3-onboard/*']
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    https: true,
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  },
  optimizeDeps: {
    exclude: ['@ethersproject/hash', 'wrtc', 'http'],
    include: ['@web3-onboard/core', 'js-sha3', '@ethersproject/bignumber'],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      }
    }
  }
};

export default config;
