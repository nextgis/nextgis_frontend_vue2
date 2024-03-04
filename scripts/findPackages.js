import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const directoryName = dirname(fileURLToPath(import.meta.url));

const isDirectory = (source) => lstatSync(source).isDirectory();

export default function findPackages(source, module = false) {
  source = source || resolve(directoryName, '..', 'packages');
  const items = [];
  const ignored = getExcludedPackages();
  readdirSync(source).forEach((name) => {
    if (ignored.indexOf('@nextgis/' + name) === -1) {
      const libPath = join(source, name);
      if (isDirectory(libPath)) {
        const packagePath = join(libPath, 'package.json');
        if (existsSync(packagePath)) {
          const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
          if (!pkg.private) {
            items.push({
              name,
              path: libPath,
              package: pkg,
            });
          }
        }
      }
    }
  });
  return items;
}

function getExcludedPackages() {
  const lernaConfigPath = resolve(directoryName, '..', 'lerna.json');
  const lernaConfig = JSON.parse(readFileSync(lernaConfigPath, 'utf8'));
  const ignored =
    lernaConfig.command &&
    lernaConfig.command.run &&
    lernaConfig.command.run.ignore;
  if (!ignored) {
    return [];
  }
  return ignored;
}
