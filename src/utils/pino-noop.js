// Mock pino during SSR to avoid transport resolution issues under Turbopack.
const noop = () => {};

const mockLogger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  child: () => mockLogger,
  level: 'silent',
};

function pino() {
  return mockLogger;
}

pino.destination = () => process.stdout;
pino.transport = () => process.stdout;

module.exports = pino;
module.exports.default = pino;
module.exports.pino = pino;
