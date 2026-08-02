/* Web crypto instead of node:crypto: importing 'crypto' from a client
   component pulls the whole crypto-browserify polyfill into the
   bundle just to make hex ids. */
export const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
