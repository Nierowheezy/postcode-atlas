/// <reference types="vite/client" />

/** Version of the running bundle, injected from package.json at build time. */
declare const __APP_VERSION__: string;

interface VersionManifest {
  version: string;
  builtAt: string;
}

interface Window {
  __ATLAS_UPDATE_READY__?: boolean;
}