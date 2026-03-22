import * as path from 'path';

const projectRoot: string = path.resolve(__dirname, '../../..');

function fromProjectRoot(...parts: string[]): string {
  return path.join(projectRoot, ...parts);
}

export {
  projectRoot,
  fromProjectRoot,
};
