import {
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBFactory,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
  indexedDB,
} from "fake-indexeddb";

const idbGlobals: Record<string, unknown> = {
  indexedDB,
  IDBKeyRange,
  IDBRequest,
  IDBTransaction,
  IDBOpenDBRequest,
  IDBVersionChangeEvent,
  IDBCursor,
  IDBCursorWithValue,
  IDBIndex,
  IDBObjectStore,
  IDBDatabase,
  IDBFactory,
};

for (const [name, value] of Object.entries(idbGlobals)) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}
