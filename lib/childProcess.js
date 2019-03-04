const { fork } = require("promisify-child-process");

module.exports = () => {
  return fork(`${__dirname}/main.js`);
};
