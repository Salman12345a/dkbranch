const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

const path = require('path');

const config = {
  resolver: {
    extraNodeModules: {
      // Alias the WebGPU entry of onnxruntime-web to its main bundle so Metro can resolve it.
      'onnxruntime-web/webgpu': path.join(__dirname, 'shims', 'ort-webgpu.js'),
    },
  },

  // Your existing Metro configuration options
};

const defaultConfig = getDefaultConfig(__dirname);
const mergedConfig = mergeConfig(defaultConfig, config);

module.exports = wrapWithReanimatedMetroConfig(mergedConfig);
