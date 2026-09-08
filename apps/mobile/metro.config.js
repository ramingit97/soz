const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo for hot reload of shared packages.
config.watchFolders = [workspaceRoot];

// Force Metro to resolve modules from project's node_modules first,
// then walk up to the workspace root (pnpm symlinks).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

// packages/shared-types отдаётся потребителям сырым TypeScript (main:
// ./src/index.ts, без сборки). Его файлы попадают в ДВА тайпчекера с
// несовместимыми требованиями к относительным импортам:
//
//   apps/api  — moduleResolution NodeNext: расширение ".js" ОБЯЗАТЕЛЬНО,
//               даже когда на диске лежит ".ts" (TS2835 без него);
//   Metro     — понимает "./language.js" буквально, ищет такой файл,
//               не находит и роняет бандлинг.
//
// Поэтому убрать ".js" в пакете нельзя (падает typecheck API), и оставить
// как есть тоже нельзя (падает сборка приложения). Разводим здесь: сначала
// обычная резолюция, и только если она не нашла файл — пробуем без ".js".
// Порядок важен — настоящий .js-файл, если он есть, побеждает.
const resolveWithJsFallback = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (/^\.{1,2}\//.test(moduleName) && moduleName.endsWith('.js')) {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

config.resolver.resolveRequest = resolveWithJsFallback;

module.exports = config;
