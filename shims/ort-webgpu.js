// Shim to satisfy Metro when @imgly/background-removal tries to import "onnxruntime-web/webgpu".
// We simply export the main onnxruntime-web entry (CPU WASM execution), as WebGPU path
// is not currently compatible with React Native.
module.exports = require('onnxruntime-web');
