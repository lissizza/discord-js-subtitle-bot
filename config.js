const fs = require('fs');

const configPath = './config.json';

function readConfig() {
  const data = fs.readFileSync(configPath);
  return JSON.parse(data);
}

function writeConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

module.exports = {
  readConfig,
  writeConfig
};
