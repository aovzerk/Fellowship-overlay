const path = require('path');

const projectRoot = path.resolve(__dirname, '../../..');

function fromProjectRoot(...parts) {
  return path.join(projectRoot, ...parts);
}

module.exports = {
  projectRoot,
  fromProjectRoot,
};
