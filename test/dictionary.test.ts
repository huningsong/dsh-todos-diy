/**
 * i18n completeness (F8.6).
 *
 * Both dictionaries must expose exactly the same keys, and every key used by a
 * component must exist — a missing key renders the raw identifier to the user.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { en } from '../src/client/dictionary-en.js'
import { zh } from '../src/client/dictionary-zh.js'

describe('dictionaries', () => {
  it('English and Chinese expose exactly the same keys', () => {
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    assert.deepEqual(enKeys, zhKeys)
  })

  it('every value is a non-empty string', () => {
    for (const [key, value] of Object.entries(zh)) {
      assert.equal(typeof value, 'string')
      assert.ok(value.length > 0, `zh.${key} is empty`)
    }
    for (const [key, value] of Object.entries(en)) {
      assert.equal(typeof value, 'string')
      assert.ok(value.length > 0, `en.${key} is empty`)
    }
  })

  it('keeps the placeholder set identical between languages', () => {
    const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort()
    const zhMap = zh as Record<string, string>
    const enMap = en as Record<string, string>
    for (const key of Object.keys(zhMap)) {
      assert.deepEqual(placeholders(enMap[key] ?? ''), placeholders(zhMap[key] ?? ''), `placeholder mismatch in ${key}`)
    }
  })

  it('has no leftover D-25 keys from the old model', () => {
    for (const key of ['form.dueDate', 'tab.todo']) {
      assert.equal(Object.hasOwn(zh, key), false, `stale key ${key}`)
    }
  })
})
