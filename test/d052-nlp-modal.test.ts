/**
 * NLP entry uses a modal textarea instead of a one-line toolbar input
 * (post-0.5.1 UX: users need room to describe a task naturally).
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { zh } from '../src/client/dictionary-zh.js'
import { en } from '../src/client/dictionary-en.js'

const here = dirname(fileURLToPath(import.meta.url))
const source = (name: string): string => readFileSync(join(here, '../../src/client', name), 'utf8')

describe('NLP entry modal', () => {
  it('renders a modal with a multiline textarea', () => {
    const bar = source('nlp-bar.ts')
    assert.ok(bar.includes('Modal'))
    assert.ok(bar.includes("'textarea'"))
    assert.ok(bar.includes('rows: 6'))
    assert.ok(bar.includes('dtd-nlpTextarea'))
  })

  it('keeps the input long enough for a natural-language sentence', () => {
    assert.ok(source('styles.ts').includes('.dtd-nlpTextarea{min-height:160px}'))
  })

  it('supports explicit parse/cancel and Ctrl/Cmd+Enter', () => {
    const bar = source('nlp-bar.ts')
    assert.ok(bar.includes("t('nlp.parse')"))
    assert.ok(bar.includes("t('form.cancel')"))
    assert.ok(bar.includes('metaKey || event.ctrlKey'))
  })

  it('keeps focus in the textarea while typing', () => {
    const ui = source('ui.ts')
    assert.ok(ui.includes('onCloseRef'))
    assert.ok(ui.includes("'input, textarea, select, [tabindex]:not([tabindex=\"-1\"]), button'"))
    assert.equal(ui.includes('}, [props.onClose, props.title])'), false)
  })

  it('has dialog hint in both languages', () => {
    assert.ok((zh as Record<string, string>)['nlp.dialog.hint']?.includes('编辑器'))
    assert.ok((en as Record<string, string>)['nlp.dialog.hint']?.includes('editor'))
  })
})
