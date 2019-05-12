import strip from 'rollup-plugin-strip';
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: 'target/js/scheduling.js',
    output: {
      file: 'dist/scheduling.js',
      format: 'umd',
      name: 'ProjectPlanningJs'
    },
    plugins: [
      strip({
        functions: ['assert'],
      }),
    ],
  },
  {
    input: 'target/js/scheduling.js',
    output: {
      file: 'dist/scheduling.min.js',
      format: 'umd',
      name: 'ProjectPlanningJs'
    },
    plugins: [
      strip({
        functions: ['assert'],
      }),
      terser(),
    ],
  },
  {
    input: 'target/js/scheduling.js',
    output: {
      dir: 'dist/es6/',
      format: 'esm'
    },
    preserveModules: true,
    plugins: [
      strip({
        functions: ['assert'],
      }),
    ],
  },
];
