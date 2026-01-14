import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
const LOG_DIR = `${baseDir}logs`;
const LOG_FILE = `${LOG_DIR}/app.log`;
const MAX_BUFFER = 200;
const FLUSH_INTERVAL_MS = 1500;

let initialized = false;
let queue: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight = false;
let originalConsole: Partial<Console> | null = null;

const safeStringify = (value: unknown) => {
  try {
    if (value instanceof Error) {
      return JSON.stringify({
        name: value.name,
        message: value.message,
        stack: value.stack,
      });
    }
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
};

const formatLine = (level: LogLevel, message: string, data?: unknown) => {
  const ts = new Date().toISOString();
  const suffix = data !== undefined ? ` ${safeStringify(data)}` : '';
  return `${ts} [${level.toUpperCase()}] ${message}${suffix}\n`;
};

const ensureLogFile = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOG_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
    }
    const fileInfo = await FileSystem.getInfoAsync(LOG_FILE);
    if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(LOG_FILE, '', { encoding: EncodingType.UTF8 });
    }
  } catch (error) {
    originalConsole?.warn?.('logger:ensureLogFile failed', error);
  }
};

const flushQueue = async () => {
  if (flushInFlight || queue.length === 0) return;
  flushInFlight = true;
  const payload = queue.join('');
  queue = [];
  try {
    const existing = await FileSystem.readAsStringAsync(LOG_FILE, { encoding: EncodingType.UTF8 }).catch(() => '');
    await FileSystem.writeAsStringAsync(LOG_FILE, existing + payload, {
      encoding: EncodingType.UTF8,
    });
  } catch (error) {
    originalConsole?.warn?.('logger:flush failed', error);
  } finally {
    flushInFlight = false;
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushQueue();
  }, FLUSH_INTERVAL_MS);
};

const enqueue = (level: LogLevel, message: string, data?: unknown) => {
  if (!initialized) return;
  queue.push(formatLine(level, message, data));
  if (queue.length > MAX_BUFFER) {
    queue = queue.slice(queue.length - MAX_BUFFER);
  }
  scheduleFlush();
};

export const logDebug = (message: string, data?: unknown) => enqueue('debug', message, data);
export const logInfo = (message: string, data?: unknown) => enqueue('info', message, data);
export const logWarn = (message: string, data?: unknown) => enqueue('warn', message, data);
export const logError = (message: string, data?: unknown) => enqueue('error', message, data);

export const exportLogsAsync = async () => {
  await ensureLogFile();
  await flushQueue();
  const available = await Sharing.isAvailableAsync().catch(() => false);
  if (available) {
    await Sharing.shareAsync(LOG_FILE, {
      dialogTitle: 'Share app logs',
      mimeType: 'text/plain',
      UTI: 'public.plain-text',
    });
    return { shared: true, uri: LOG_FILE };
  }
  return { shared: false, uri: LOG_FILE };
};

export const clearLogsAsync = async () => {
  await ensureLogFile();
  await FileSystem.writeAsStringAsync(LOG_FILE, '', { encoding: EncodingType.UTF8 });
};

export const getLogFileUri = () => LOG_FILE;

export const initAppLogger = () => {
  if (initialized || process.env.NODE_ENV === 'test') return;
  initialized = true;
  originalConsole = { ...console };
  ensureLogFile();
  logInfo('APP_START', { state: AppState.currentState });

  console.log = (...args: unknown[]) => {
    originalConsole?.log?.(...args);
    enqueue('info', args.map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    originalConsole?.warn?.(...args);
    enqueue('warn', args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    originalConsole?.error?.(...args);
    enqueue('error', args.map(String).join(' '));
  };

  const errorUtils = (globalThis as any).ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
    enqueue('error', 'UNHANDLED_ERROR', {
      message: error?.message,
      stack: error?.stack,
      isFatal: Boolean(isFatal),
    });
    previousHandler?.(error, isFatal);
  });

  (globalThis as any).onunhandledrejection = (event: any) => {
    const reason = event?.reason;
    enqueue('error', 'UNHANDLED_REJECTION', reason);
  };

  AppState.addEventListener('change', (nextState) => {
    enqueue('info', 'APP_STATE', { state: nextState });
    if (nextState === 'background') {
      flushQueue();
    }
  });
};
