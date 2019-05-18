import babel from 'rollup-plugin-babel';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from "rollup-plugin-terser";

function searchAndReplace() {
  return ['search-and-replace', {
    rules: [{
      search: './worker.ts',
      replace: './worker.js',
    }]
  }];
}

/**
 * Both Babel and Rollup have features to combine the source maps of two consecutive transformations. It is therefore
 * important not to use both. Luckily, we can set Babel’s `inputSourceMap` option to false, in order to make Babel
 * ignore the source maps in src/target/js that were created by the TypeScript compiler.
 */
const inputSourceMap = false;

export default [
  {
    input: 'target/js/umd/index.js',
    output: {
      file: 'dist/index.js',
      format: 'umd',
      name: 'ProjectPlanningJs',
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
    plugins: [
      sourcemaps(),
      babel({
        inputSourceMap,
        presets: ['@babel/preset-env'],
        plugins: ['babel-plugin-unassert']
      }),
    ],
  },
  {
    input: 'target/js/umd/index.js',
    output: {
      file: 'dist/index.min.js',
      format: 'umd',
      name: 'ProjectPlanningJs',
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
    plugins: [
      sourcemaps(),
      babel({
        inputSourceMap,
        presets: ['@babel/preset-env'],
        plugins: ['babel-plugin-unassert']
      }),
      terser(),
    ],
  },
  {
    input: ['target/js/index.js', 'target/js/worker.js'],
    output: {
      dir: 'dist/es6/',
      format: 'esm',
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
    preserveModules: true,
    plugins: [
      sourcemaps(),
      babel({
        inputSourceMap,
        plugins: ['babel-plugin-unassert', searchAndReplace()],
      }),
    ],
  },
];
