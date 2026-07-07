/**
 * Jest environment polyfills.
 *
 * jsdom does not expose TextEncoder/TextDecoder, which react-dom/server (and
 * other libraries) require. Provide them from Node's util module.
 */
const {TextEncoder, TextDecoder} = require('util');

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder;
}
