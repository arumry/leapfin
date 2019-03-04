#!/usr/bin/env node

process.on("uncaughtException", e => {
  console.error(
    `Unable to execute program due to an uncaught exception: ${e.message}`
  );
  process.exit(1);
});
process.on("unhandledRejection", e => {
  console.error(
    `Unable to execute program due to an unhandled rejection: ${e.message}`
  );
  process.exit(1);
});

require("console.table");
const program = require("commander");
const { meanBy, omit } = require("lodash");
const pjson = require("../package.json");
const {
  DEFAULT_EXECUTION_TIME,
  NUM_WORKERS,
  STATUSES
} = require("./constants");

const startChildProcess = require("./childProcess");

program
  .version(pjson.version)
  .option(
    "-t, --timeout [milliseconds]",
    "Time limit for stream workers to function",
    parseInt
  )
  .parse(process.argv);

const timeout = program.timeout === undefined ? 60000 : program.timeout;
if (!Number.isInteger(timeout)) {
  console.error("-t, --timeout must be a valid integer");
  process.exit(1);
}

const defaultWorkerState = {
  err: "Unknown error",
  status: STATUSES.ERROR,
  bytesRead: 0,
  time: 0
};

const exitedWorkers = [];
const workerState = {};
const workerError = status => {
  return [STATUSES.ERROR, STATUSES.TIMEOUT].includes(status);
};
const workerMsgFn = pid => {
  return message => {
    if (!workerState[pid]) workerState[pid] = message;
  };
};

const workers = Array.from({ length: NUM_WORKERS }, startChildProcess);
workers.forEach(w => {
  const workerStateFn = workerMsgFn(w.pid);
  w.on("exit", () => {
    exitedWorkers.push(w.pid);
  });
  w.on("message", workerStateFn);
  w.catch(e => {
    workerStateFn(
      Object.assign({}, defaultWorkerState, { err: e && e.message })
    );
  });
});

const timeoutId = setTimeout(() => {
  workers
    .filter(w => !exitedWorkers.includes(w.pid))
    .forEach(w => {
      w.send(STATUSES.TIMEOUT);
    });
}, timeout);

Promise.all(workers).then(() => {
  clearTimeout(timeoutId);

  const workerResults = Object.keys(workerState)
    .map(k => {
      const s = workerState[k];
      const status = s.status;
      const hasErrorStatus = workerError(status);

      return {
        pid: k,
        err: s.err,
        hasErrorStatus,
        elapsed: hasErrorStatus ? null : s.time,
        byte_cnt: hasErrorStatus ? null : s.bytesRead,
        status
      };
    })
    .sort((a, b) => {
      return b.elapsed - a.elapsed;
    });

  console.table(
    workerResults.map(r => omit(r, ["err", "hasErrorStatus", "pid"]))
  );

  const errorResults = workerResults.filter(r => r.hasErrorStatus);
  const successfulResults = workerResults.filter(r => !r.hasErrorStatus);

  if (successfulResults.length) {
    console.log(
      `Average read throughput: ${Math.round(
        meanBy(successfulResults, o => {
          return o.byte_cnt / o.elapsed;
        })
      )} bytes/millisecond per worker`
    );
  }

  if (errorResults.length) {
    errorResults.forEach(r => {
      console.error(`pid ${r.pid} failed with: ${r.err}`);
    });
  }
});
