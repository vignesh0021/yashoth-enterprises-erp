export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'vitest') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./vitest-shim.mjs', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
