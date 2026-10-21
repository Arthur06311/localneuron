const { join } = require('node:path');

// RunAsNode stays on: the desktop process starts the local server with
// ELECTRON_RUN_AS_NODE. Asar fuses stay off because that child is plain Node
// and cannot read an asar archive. The other fuses close injectors.
// WasmTrapHandlers stays Enabled, which is Electron's default.
const DESIRED_FUSES = Object.freeze({
  runAsNode: true,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: false,
  onlyLoadAppFromAsar: false,
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: false,
  wasmTrapHandlers: true,
});

function electronBinary(outputDir, platform) {
  if (platform === 'darwin') return join(outputDir, 'LocalNeuron.app', 'Contents', 'MacOS', 'LocalNeuron');
  return join(outputDir, platform === 'win32' ? 'LocalNeuron.exe' : 'LocalNeuron');
}

function fuseFlipConfig(FuseV1Options, FuseVersion) {
  return {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: true,
    [FuseV1Options.RunAsNode]: DESIRED_FUSES.runAsNode,
    [FuseV1Options.EnableCookieEncryption]: DESIRED_FUSES.enableCookieEncryption,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: DESIRED_FUSES.enableNodeOptionsEnvironmentVariable,
    [FuseV1Options.EnableNodeCliInspectArguments]: DESIRED_FUSES.enableNodeCliInspectArguments,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: DESIRED_FUSES.enableEmbeddedAsarIntegrityValidation,
    [FuseV1Options.OnlyLoadAppFromAsar]: DESIRED_FUSES.onlyLoadAppFromAsar,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: DESIRED_FUSES.loadBrowserProcessSpecificV8Snapshot,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: DESIRED_FUSES.grantFileProtocolExtraPrivileges,
    [FuseV1Options.WasmTrapHandlers]: DESIRED_FUSES.wasmTrapHandlers,
  };
}

async function applyElectronFuses(binaryPath) {
  const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
  await flipFuses(binaryPath, fuseFlipConfig(FuseV1Options, FuseVersion));
}

module.exports = { DESIRED_FUSES, electronBinary, fuseFlipConfig, applyElectronFuses };
