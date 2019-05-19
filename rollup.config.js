import babel from 'rollup-plugin-babel';
import { terser } from "rollup-plugin-terser";

function searchAndReplace() {
  return ['search-and-replace', {
    rules: [{
      search: './worker.ts',
      replace: './worker.js',
    }]
  }];
}

export default [
  {
    input: 'target/js/index.js',
    output: {
      file: 'dist/index.js',
      format: 'umd',
      name: 'ProjectPlanningJs'
    },
    plugins: [
      babel({
        presets: ['@babel/preset-env'],
        plugins: ['babel-plugin-unassert']
      }),
    ],
  },
  {
    input: 'target/js/index.js',
    output: {
      file: 'dist/index.min.js',
      format: 'umd',
      name: 'ProjectPlanningJs'
    },
    plugins: [
      babel({
        presets: ['@babel/preset-env'],
        plugins: ['babel-plugin-unassert']
      }),
      terser(),
    ],
  },
  {
    input: 'target/js/index.js',
    output: {
      dir: 'dist/es6/',
      format: 'esm'
    },
    preserveModules: true,
    plugins: [
      babel({
        plugins: ['babel-plugin-unassert', searchAndReplace()]
      }),
    ],
  },
];
