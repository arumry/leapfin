const each = require("stream-each");
const containsString = require("./containsString");
const InfiniteStringStream = require("./infiniteStringStream");
const { STATUSES } = require("./constants");

const getMs = hrstart => {
  const diff = process.hrtime(hrstart);
  const nano = diff[0] * 1e9 + diff[1];
  return Math.round(nano / 1e6);
};
const notifyParent = message => {
  process.send && process.send(message);
};

const infiniteStringStream = new InfiniteStringStream();
const hrstart = process.hrtime();
let bytesRead = 0;

process.on("uncaughtException", err => {
  notifyParent({
    err: err.message,
    bytesRead,
    status: STATUSES.ERROR,
    time: getMs(hrstart)
  });
  process.exit(0);
});

process.on("message", m => {
  if (m === STATUSES.TIMEOUT) {
    notifyParent({
      err: "Timeout occurred",
      bytesRead,
      status: STATUSES.TIMEOUT,
      time: getMs(hrstart)
    });
    infiniteStringStream.destroy();
    process.exit(0);
  }
});

each(
  infiniteStringStream,
  (data, next) => {
    bytesRead += data.byteLength;
    if (containsString(data)) {
      notifyParent({
        err: null,
        bytesRead,
        status: STATUSES.SUCCESS,
        time: getMs(hrstart)
      });
      infiniteStringStream.destroy();
      process.exit(0);
    }
    setImmediate(next); // execute next buffer after any potential i/o needs to occur (i.e parent communicating with child)
  },
  err => {
    notifyParent({
      err: err.message,
      status: STATUSES.ERROR,
      bytesRead,
      time: getMs(hrstart)
    });
    process.exit(0);
  }
);
