import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import postcssUrl from 'postcss-url';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';
import Icons from 'unplugin-icons/rollup';

const production = process.env.NODE_ENV === 'production' || !process.env.ROLLUP_WATCH;

export default {
  input: 'src/svelte/main.js',
  output: {
    sourcemap: !production,
    format: 'es',
    name: 'SvelteEditorComponents',
    dir: 'dist/svelte',
    entryFileNames: 'editor-components.js',
    chunkFileNames: '[name]-[hash].js'
  },
  plugins: [
    json(),
    Icons({
      compiler: 'svelte',
    }),
    copy({
      targets: [
        {
          src: 'node_modules/@fontsource/recursive/files/*',
          dest: 'dist/svelte/files'
        },
        {
          src: 'node_modules/@fortawesome/fontawesome-free/webfonts/*',
          dest: 'dist/svelte/webfonts'
        }
      ]
    }),
    postcss({
      extract: 'editor-styles.css',
      minimize: production,
      plugins: [
        postcssUrl({
          url: (asset) => {
            // Rewrite Font Awesome font paths
            if (asset.url.includes('../webfonts/')) {
              return asset.url.replace('../webfonts/', './webfonts/');
            }
            return asset.url;
          }
        })
      ]
    }),
    svelte({
      compilerOptions: {
        dev: !production
      },
      emitCss: false 
    }),
    resolve({
      browser: true,
      dedupe: ['svelte'],
      preferBuiltins: false
    }),
    commonjs(),
    
    production && terser()
  ],
  watch: {
    clearScreen: false
  }
};
