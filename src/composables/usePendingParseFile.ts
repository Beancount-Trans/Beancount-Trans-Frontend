/**
 * 待重解析账单文件：登录前选中的文件临时存入浏览器 IndexedDB，
 * 登录成功后回跳解析页，用用户自己的账户与映射重新解析同一份账单。
 *
 * 纯本地存储，带过期时间，读取即删除；不可用时静默失败，不影响主流程。
 */

const DB_NAME = 'beancount-trans'
const STORE_NAME = 'pending-parse-file'
const RECORD_KEY = 'current-file'
const MAX_AGE_MS = 30 * 60 * 1000

interface PendingParseRecord {
  blob: Blob
  name: string
  type: string
  lastModified: number
  savedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const request = action(transaction.objectStore(STORE_NAME))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => db.close()
        transaction.onerror = () => db.close()
      })
  )
}

function deleteRecord(): Promise<undefined> {
  return withStore<undefined>('readwrite', (store) => store.delete(RECORD_KEY))
}

/** 暂存待重解析的文件 */
export async function savePendingParseFile(file: File): Promise<void> {
  try {
    const record: PendingParseRecord = {
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      savedAt: Date.now()
    }
    await withStore<IDBValidKey>('readwrite', (store) => store.put(record, RECORD_KEY))
  } catch (error) {
    console.warn('暂存待重解析账单失败:', error)
  }
}

/** 取出并删除待重解析的文件；无记录或已过期时返回 null */
export async function takePendingParseFile(): Promise<File | null> {
  try {
    const record = await withStore<PendingParseRecord | undefined>(
      'readonly',
      (store) => store.get(RECORD_KEY)
    )
    await deleteRecord()
    if (!record || !record.blob) return null
    if (Date.now() - record.savedAt > MAX_AGE_MS) return null
    if (record.blob instanceof File) return record.blob
    return new File([record.blob], record.name, {
      type: record.type,
      lastModified: record.lastModified
    })
  } catch (error) {
    console.warn('读取待重解析账单失败:', error)
    return null
  }
}

/** 清除待重解析的文件 */
export async function clearPendingParseFile(): Promise<void> {
  try {
    await deleteRecord()
  } catch (error) {
    console.warn('清除待重解析账单失败:', error)
  }
}
