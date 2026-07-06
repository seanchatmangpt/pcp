// Metro config for the template app inside the pcp monorepo.
// Mirrors the path aliases declared in the repo-root tsconfig.json:
//   @/*              -> <repo root>/*
//   ~/*              -> <repo root>/src/*
//   @pcp/framework/* -> <repo root>/src/framework/*
// Without this file Metro has no alias resolver and every '@/src/...'
// import fails to resolve during `expo export --platform web`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Let Metro see files that live at the workspace root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

// expo-sqlite's web backend ships wa-sqlite.wasm; Metro must treat .wasm as an asset.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let mapped = moduleName;
  if (moduleName.startsWith('@/')) {
    mapped = path.join(workspaceRoot, moduleName.slice(2));
  } else if (moduleName.startsWith('~/')) {
    mapped = path.join(workspaceRoot, 'src', moduleName.slice(2));
  } else if (moduleName === '@pcp/framework') {
    mapped = path.join(workspaceRoot, 'src', 'framework');
  } else if (moduleName.startsWith('@pcp/framework/')) {
    mapped = path.join(workspaceRoot, 'src', 'framework', moduleName.slice('@pcp/framework/'.length));
  } else if (moduleName.startsWith('@pcp/')) {
    mapped = path.join(workspaceRoot, 'src', 'framework', moduleName.slice('@pcp/'.length));
  }
  const resolve = defaultResolveRequest || context.resolveRequest;
  try {
    return resolve(context, mapped, platform);
  } catch (err) {
    // Fallback for relative imports written against the workspace layout:
    // app code under apps/template-app/src/** reaches for ../../framework/...,
    // which only exists at <repo root>/src/**. Retry there before failing.
    if (mapped.startsWith('.') && context.originModulePath) {
      const absolute = path.resolve(path.dirname(context.originModulePath), mapped);
      const appSrc = path.join(projectRoot, 'src') + path.sep;
      if (absolute.startsWith(appSrc)) {
        const retry = path.join(workspaceRoot, 'src', absolute.slice(appSrc.length));
        return resolve(context, retry, platform);
      }
    }
    throw err;
  }
};

module.exports = config;
