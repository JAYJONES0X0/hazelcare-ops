import { beforeEach } from 'vitest'

function createStorageMock(): Storage {
  let store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store = new Map()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

function installStorageMock() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createStorageMock(),
    writable: true,
  })
}

installStorageMock()

beforeEach(() => {
  installStorageMock()
})
