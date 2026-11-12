import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy';

const production = process.env.NODE_ENV === 'production' || !process.env.ROLLUP_WATCH;

const forgeViewer = {
  input: 'src/forge/viewer/main.js',
  output: {
    format: 'es',
    file: 'static/viewer/viewer.js',
    inlineDynamicImports: true
  },
  plugins: [
    copy({
      targets: [
        { src: 'src/forge/viewer/index.html', dest: 'static/viewer' },
        { src: 'public/icon_80x80.png', dest: 'static/viewer' }
      ]
    }),
    postcss({
      extract: 'viewer.css',
      minimize: production,
      config: false
    }),
    resolve({ browser: true }),
    commonjs(),
    production && terser()
  ]
};

const forgeEditor = {
  input: 'src/forge/editor/main.js',
  output: {
    format: 'es',
    file: 'static/editor/editor.js',
    inlineDynamicImports: true
  },
  plugins: [
    copy({
      targets: [
        { src: 'src/forge/editor/index.html', dest: 'static/editor' },
        { src: 'public/spinner.svg', dest: 'static/editor' }
      ]
    }),
    postcss({
      extract: 'editor.css',
      minimize: production,
      config: false
    }),
    resolve({
      browser: true,
      dedupe: ['preact']
    }),
    commonjs(),
    production && terser()
  ]
};

export default [forgeViewer, forgeEditor];
