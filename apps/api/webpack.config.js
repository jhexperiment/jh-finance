module.exports = (options) => {
  const defaultExternals = options.externals;
  return {
    ...options,
    externals: [
      ({ request, context, contextInfo, getResolve }, callback) => {
        if (request === 'shared' || (typeof request === 'string' && request.startsWith('shared/'))) {
          return callback();
        }
        const next = Array.isArray(defaultExternals)
          ? defaultExternals[0]
          : defaultExternals;
        if (typeof next === 'function') {
          return next({ request, context, contextInfo, getResolve }, callback);
        }
        return callback();
      },
    ],
  };
};
