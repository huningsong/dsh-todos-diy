/**
 * In-memory `FileSystem` used by the storage tests.
 *
 * Behaviour matches the subset of `node:fs` the store uses, including the
 * failure injection points §10.1 requires: `ENOSPC`, `EACCES`, a rename that
 * fails, and a corrupt file on disk.
 */

import type { FileSystem } from '../src/host/store.js'

/** A virtual file table with injectable failures. */
export interface MemoryFs extends FileSystem {
  /** List the direct children of a directory (the archive layer needs it). */
  listDir(path: string): string[]
  /** path → content */
  files: Map<string, string>
  /** Directories that exist. */
  dirs: Set<string>
  /** Set to make the next/all writes fail with this errno-style message. */
  failWrite: string | null
  /** Set to make the next/all renames fail. */
  failRename: string | null
  /** Set to make reads fail. */
  failRead: string | null
  /** Number of physical writes performed. */
  writeCount: number
  /** Number of successful renames performed (one per durable write). */
  renameCount: number
}

/** Create a fresh in-memory filesystem. */
export function createMemoryFs(): MemoryFs {
  const files = new Map<string, string>()
  const dirs = new Set<string>()
  const fs: MemoryFs = {
    files,
    dirs,
    failWrite: null,
    failRename: null,
    failRead: null,
    writeCount: 0,
    renameCount: 0,
    readFile(path) {
      if (fs.failRead !== null) throw new Error(fs.failRead)
      const content = files.get(path)
      if (content === undefined) throw new Error(`ENOENT: no such file or directory, open '${path}'`)
      return content
    },
    writeFile(path, content) {
      if (fs.failWrite !== null) throw new Error(fs.failWrite)
      files.set(path, content)
      fs.writeCount += 1
    },
    rename(from, to) {
      if (fs.failRename !== null) throw new Error(fs.failRename)
      const content = files.get(from)
      if (content === undefined) throw new Error(`ENOENT: no such file or directory, rename '${from}'`)
      files.delete(from)
      files.set(to, content)
      fs.renameCount += 1
    },
    unlink(path) {
      files.delete(path)
    },
    mkdir(path) {
      dirs.add(path)
    },
    exists(path) {
      return files.has(path) || dirs.has(path)
    },
    copyFile(from, to) {
      const content = files.get(from)
      if (content === undefined) throw new Error(`ENOENT: no such file or directory, copyfile '${from}'`)
      files.set(to, content)
    },
    listDir(path) {
      const names: string[] = []
      const prefix = `${path}/`
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (rest.includes('/')) continue
        names.push(rest)
      }
      return names
    },
    mtimeMs(path) {
      if (!files.has(path)) throw new Error(`ENOENT: ${path}`)
      return fs.writeCount
    },
  }
  return fs
}
