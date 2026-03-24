import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const tempDir = path.join(rootDir, 'test/.tmp/card-review-followup');
fs.mkdirSync(tempDir, { recursive: true });

function tempModuleUrl(filename) {
  return pathToFileURL(path.join(tempDir, filename)).href;
}

function writeTempModule(filename, content) {
  const target = path.join(tempDir, filename);
  fs.writeFileSync(target, content, 'utf8');
  return tempModuleUrl(filename);
}

function loadSource(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function writeCardErrorModule() {
  const apiErrorStubUrl = writeTempModule(
    'api-error.stub.mjs',
    'export function extractLarkApiCode() { return undefined; }\n',
  );

  const source = loadSource('src/card/card-error.ts').replace("'../core/api-error'", `'${apiErrorStubUrl}'`);
  const filename = `card-error.${Date.now()}-${Math.random().toString(16).slice(2)}.ts`;
  fs.writeFileSync(path.join(tempDir, filename), source, 'utf8');
  return tempModuleUrl(filename);
}

function writeReplyModeModule(cardErrorUrl) {
  const source = loadSource('src/card/reply-mode.ts')
    .replace("import type { FeishuConfig } from '../core/types';\n", 'type FeishuConfig = any;\n')
    .replace("'./card-error'", `'${cardErrorUrl}'`);

  const filename = `reply-mode.${Date.now()}-${Math.random().toString(16).slice(2)}.ts`;
  fs.writeFileSync(path.join(tempDir, filename), source, 'utf8');
  return tempModuleUrl(filename);
}

function writeStreamingControllerModule(cardErrorUrl) {
  const pluginSdkStubUrl = writeTempModule(
    'plugin-sdk.stub.mjs',
    "export const SILENT_REPLY_TOKEN = '__silent__';\n",
  );
  const apiErrorStubUrl = writeTempModule(
    'controller-api-error.stub.mjs',
    'export function extractLarkApiCode() { return undefined; }\n',
  );
  const loggerStubUrl = writeTempModule(
    'lark-logger.stub.mjs',
    [
      'export function larkLogger() {',
      '  return { debug() {}, info() {}, warn() {}, error() {} };',
      '}',
      '',
    ].join('\n'),
  );
  const shutdownHooksStubUrl = writeTempModule(
    'shutdown-hooks.stub.mjs',
    'export function registerShutdownHook() { return () => {}; }\n',
  );
  const outboundSendStubUrl = writeTempModule(
    'outbound-send.stub.mjs',
    [
      'export async function sendCardFeishu() { return { messageId: "msg_stub" }; }',
      'export async function updateCardFeishu() {}',
      '',
    ].join('\n'),
  );
  const builderStubUrl = writeTempModule(
    'builder.stub.mjs',
    [
      'export const STREAMING_ELEMENT_ID = "streaming";',
      'export function splitReasoningText(text) { return { answerText: text }; }',
      'export function stripReasoningTags(text) { return text; }',
      'export function toCardKit2(card) { return card; }',
      'export function buildCardContent(state, data = {}) { return { state, ...data }; }',
      '',
    ].join('\n'),
  );
  const cardkitStubUrl = writeTempModule(
    'cardkit.stub.mjs',
    [
      'export async function createCardEntity() { return "card_stub"; }',
      'export async function sendCardByCardId() { return { messageId: "msg_stub" }; }',
      'export async function setCardStreamingMode() {}',
      'export async function streamCardContent() {}',
      'export async function updateCardKitCard() {}',
      '',
    ].join('\n'),
  );
  const flushControllerStubUrl = writeTempModule(
    'flush-controller.stub.mjs',
    [
      'export class FlushController {',
      '  constructor(flush) { this.flush = flush; }',
      '  cancelPendingFlush() {}',
      '  complete() {}',
      '  waitForFlush() { return Promise.resolve(); }',
      '  setCardMessageReady() {}',
      '  throttledUpdate() { return Promise.resolve(); }',
      '}',
      '',
    ].join('\n'),
  );
  const imageResolverStubUrl = writeTempModule(
    'image-resolver.stub.mjs',
    [
      'export class ImageResolver {',
      '  constructor() {}',
      '  resolveImages(text) { return text; }',
      '  resolveImagesAwait(text) { return Promise.resolve(text); }',
      '}',
      '',
    ].join('\n'),
  );
  const markdownStyleStubUrl = writeTempModule(
    'markdown-style.stub.mjs',
    'export function optimizeMarkdownStyle(text) { return text; }\n',
  );
  const dispatcherTypesStubUrl = writeTempModule(
    'reply-dispatcher-types.stub.mjs',
    [
      'export const EMPTY_REPLY_FALLBACK_TEXT = "Done.";',
      'export const PHASE_TRANSITIONS = {',
      '  idle: new Set(["creating", "aborted", "terminated"]),',
      '  creating: new Set(["streaming", "creation_failed", "aborted", "terminated"]),',
      '  streaming: new Set(["completed", "aborted", "terminated"]),',
      '  completed: new Set(),',
      '  aborted: new Set(),',
      '  terminated: new Set(),',
      '  creation_failed: new Set(),',
      '};',
      'export const TERMINAL_PHASES = new Set(["completed", "aborted", "terminated", "creation_failed"]);',
      'export const THROTTLE_CONSTANTS = { CARDKIT_MS: 100, PATCH_MS: 1500 };',
      '',
    ].join('\n'),
  );
  const unavailableGuardStubUrl = writeTempModule(
    'unavailable-guard.stub.mjs',
    [
      'export class UnavailableGuard {',
      '  constructor() {}',
      '  shouldSkip() { return false; }',
      '  terminate() { return false; }',
      '  get isTerminated() { return false; }',
      '}',
      '',
    ].join('\n'),
  );

  const source = loadSource('src/card/streaming-card-controller.ts')
    .replace(
      "import { type ReplyPayload, SILENT_REPLY_TOKEN } from 'openclaw/plugin-sdk';",
      `import { SILENT_REPLY_TOKEN } from '${pluginSdkStubUrl}';\ntype ReplyPayload = any;`,
    )
    .replace(
      "import type {\n  CardKitState,\n  CardPhase,\n  ReasoningState,\n  StreamingCardDeps,\n  StreamingTextState,\n  TerminalReason,\n} from './reply-dispatcher-types';",
      'type CardKitState = any;\ntype CardPhase = any;\ntype ReasoningState = any;\ntype StreamingCardDeps = any;\ntype StreamingTextState = any;\ntype TerminalReason = any;',
    )
    .replace("'../core/api-error'", `'${apiErrorStubUrl}'`)
    .replace("'../core/lark-logger'", `'${loggerStubUrl}'`)
    .replace("'../core/shutdown-hooks'", `'${shutdownHooksStubUrl}'`)
    .replace("'../messaging/outbound/send'", `'${outboundSendStubUrl}'`)
    .replace("'./builder'", `'${builderStubUrl}'`)
    .replace("'./card-error'", `'${cardErrorUrl}'`)
    .replace("'./cardkit'", `'${cardkitStubUrl}'`)
    .replace("'./flush-controller'", `'${flushControllerStubUrl}'`)
    .replace("'./image-resolver'", `'${imageResolverStubUrl}'`)
    .replace("'./markdown-style'", `'${markdownStyleStubUrl}'`)
    .replace("'./reply-dispatcher-types'", `'${dispatcherTypesStubUrl}'`)
    .replace("'./unavailable-guard'", `'${unavailableGuardStubUrl}'`);

  const filename = `streaming-card-controller.${Date.now()}-${Math.random().toString(16).slice(2)}.ts`;
  fs.writeFileSync(path.join(tempDir, filename), source, 'utf8');
  return tempModuleUrl(filename);
}

function buildTable(label) {
  return `| name | value |\n| --- | --- |\n| ${label} | ${label} |`;
}

function buildCodeBlockWithTables(count) {
  return [
    '```md',
    ...Array.from({ length: count }, (_, index) => buildTable(`code-${index + 1}`)),
    '```',
  ].join('\n\n');
}

test('shouldUseCard ignores fenced-code tables when checking the table limit', async () => {
  const cardErrorUrl = writeCardErrorModule();
  const replyModeUrl = writeReplyModeModule(cardErrorUrl);
  const { shouldUseCard } = await import(`${replyModeUrl}?case=${Date.now()}`);

  const text = buildCodeBlockWithTables(4);

  assert.equal(shouldUseCard(text), true);
});

test('sanitizeTextForCard only wraps excess tables outside fenced code blocks', async () => {
  const cardErrorUrl = writeCardErrorModule();
  const { sanitizeTextForCard } = await import(`${cardErrorUrl}?case=${Date.now()}`);

  const text = [
    buildCodeBlockWithTables(4),
    buildTable('real-1'),
    buildTable('real-2'),
    buildTable('real-3'),
    buildTable('real-4'),
  ].join('\n\n');

  const sanitized = sanitizeTextForCard(text);

  assert.match(sanitized, /```md[\s\S]*\| code-4 \| code-4 \|[\s\S]*```/);
  assert.match(sanitized, /```\n\| name \| value \|\n\| --- \| --- \|\n\| real-4 \| real-4 \|\n```/);
  assert.ok(!sanitized.includes('```\n| name | value |\n| --- | --- |\n| code-4 | code-4 |\n```'));
});

test('streaming terminal helper shares the table budget across reasoning and body', async () => {
  const cardErrorUrl = writeCardErrorModule();
  const controllerUrl = writeStreamingControllerModule(cardErrorUrl);
  const { findMarkdownTablesOutsideCodeBlocks } = await import(`${cardErrorUrl}?case=${Date.now()}-tables`);
  const { prepareTerminalCardContent } = await import(`${controllerUrl}?case=${Date.now()}`);

  assert.equal(typeof prepareTerminalCardContent, 'function');

  const rawText = [
    'Before',
    buildTable('real-1'),
    buildTable('real-2'),
    'After',
  ].join('\n\n');
  const rawReasoningText = [
    buildTable('reason-1'),
    buildTable('reason-2'),
  ].join('\n\n');
  const imageResolver = {
    resolveImages(text) {
      return text.replace('Before', 'Resolved');
    },
  };

  const safeContent = prepareTerminalCardContent(
    {
      text: rawText,
      reasoningText: rawReasoningText,
    },
    imageResolver,
  );

  assert.match(safeContent.text, /^Resolved/);
  assert.equal(findMarkdownTablesOutsideCodeBlocks(safeContent.reasoningText).length, 2);
  assert.equal(findMarkdownTablesOutsideCodeBlocks(safeContent.text).length, 1);
  assert.match(safeContent.text, /```\n\| name \| value \|\n\| --- \| --- \|\n\| real-2 \| real-2 \|\n```/);
  assert.ok(!safeContent.reasoningText.includes('```\n| name | value |'));
});
