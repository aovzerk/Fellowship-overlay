// Central place for resolving project-relative paths.
const path = require('path');

// src/main/utils -> project root
const projectRoot = path.resolve(__dirname, '../../..');

function fromProjectRoot(...parts) {
  return path.join(projectRoot, ...parts);
}

module.exports = {
  projectRoot,
  fromProjectRoot,
};
