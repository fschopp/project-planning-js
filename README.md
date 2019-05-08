Algorithm for project planning. More specifically, a greedy algorithm for scheduling jobs on related machines, with optional preemption and splitting of jobs across machines.

## Status


## Overview

- [Interactive demo](https://fschopp.github.io/project-planning-js/demo/)
- No dependencies
- Tests have [full code coverage](https://fschopp.github.io/project-planning-js/coverage/)

## License

[Apache License 2.0](LICENSE)

## Releases

Published releases include TypeScript type declarations and are available as either [UMD](https://github.com/umdjs/umd) or ECMAScript 2015 (aka ES6) modules.

## Project Documentation

- [API documentation](https://fschopp.github.io/project-planning-js/doc/)


## Algorithm Description

- See [this example](https://fschopp.github.io/project-planning-js/demo/#src=%7B%0A%20%20%22machineSpeeds%22%3A%20%5B10%2C%201%5D%2C%0A%20%20%22jobs%22%3A%20%5B%0A%20%20%20%20%7B%22timeOnUnitMachine%22%3A%2010%2C%20%22earliestStart%22%3A%201%7D%2C%0A%20%20%20%20%7B%22timeOnUnitMachine%22%3A%2023%2C%20%22splitting%22%3A%20%22multi%22%7D%2C%0A%20%20%20%20%7B%22timeOnUnitMachine%22%3A%2010%2C%20%22earliestStart%22%3A%205%7D%2C%0A%20%20%20%20%7B%22timeOnUnitMachine%22%3A%2030%2C%20%22splitting%22%3A%20%22none%22%7D%0A%20%20%5D%0A%7D).
