const { SEARCH_STRING } = require("./constants");

module.exports = buffer => buffer.indexOf(SEARCH_STRING) !== -1;
