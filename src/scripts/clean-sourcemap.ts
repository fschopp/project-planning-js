/**
 * Script to remove the `sourcesContent` property in a Source Map (typically, a *.map file).
 *
 * The rationale is that some viewers (for instance, JetBrains IntelliJ) cannot visualize source maps where that
 * property is null. Instead, an error is shown “Cannot decode sourcemap”.
 */

import fs from 'fs';
for (let i = 2; i < process.argv.length; ++i) {
  const fileName: string = process.argv[i];
  const sourceMap: {sourcesContent?: string | null} = JSON.parse(fs.readFileSync(fileName).toString());
  if ('sourcesContent' in sourceMap) {
    delete sourceMap.sourcesContent;
    fs.writeFileSync(fileName, JSON.stringify(sourceMap));
  }
}
