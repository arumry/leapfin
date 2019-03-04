const randomString = require("randomstring");
const stream = require("stream");

const { SEARCH_STRING } = require("./constants");

function InfiniteStringStream(options) {
  stream.Readable.call(this, options);
}

InfiniteStringStream.prototype = Object.create(stream.Readable.prototype);
InfiniteStringStream.prototype.constructor = stream.Readable;

InfiniteStringStream.prototype._read = function() {
  const buf = Buffer.from(
    randomString.generate({
      length: SEARCH_STRING.length,
      charset: "alphabetic"
    })
  );
  this.push(buf);
};

module.exports = InfiniteStringStream;
