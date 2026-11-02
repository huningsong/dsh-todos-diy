/**
 * Desktop system notification UX (F5.13/F9.7/UX-30).
 *
 * 0.7.0 moves the permission/test/guidance UI from the task editor to Settings;
 * this file asserts that split at the source-contract level.
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

describe('global desktop notification setting', () => {
  it('renders the switch, permission status, test and platform guide in Settings', () => {
    const settings = source('settings-modal.ts')
    assert.ok(settings.includes("t('settings.desktopNotifications')"))
    assert.ok(settings.includes('getNotificationPermission'))
    assert.ok(settings.includes('requestNotificationPermission'))
    assert.ok(settings.includes('sendTestNotification'))
    assert.ok(settings.includes('form.notify.guide'))
    assert.ok(settings.includes('form.notify.systemStatus'))
  })

  it('removes task-level system-notification UI', () => {
    const editor = source('task-editor.ts')
    assert.equal(editor.includes('form.notify.system'), false)
    assert.equal(editor.includes('testSystemNotification'), false)
    assert.equal(editor.includes('systemNotification'), false)
    assert.ok(editor.includes("t('form.notify.overlayHint')"))
  })

  it('has all permission states and platform guidance in both languages', () => {
    for (const key of ['granted', 'default', 'denied', 'unsupported']) {
      assert.ok((zh as Record<string, string>)[`form.notify.systemStatus.${key}`])
      assert.ok((en as Record<string, string>)[`form.notify.systemStatus.${key}`])
    }
    for (const platform of ['mac', 'windows', 'other']) {
      assert.ok((zh as Record<string, string>)[`form.notify.guide.${platform}`])
      assert.ok((en as Record<string, string>)[`form.notify.guide.${platform}`])
    }
  })

  it('keeps the test notification event-based', () => {
    const helper = source('notify-permission.ts')
    assert.ok(helper.includes('sendTestNotification'))
    assert.ok(helper.includes('notification.onshow'))
    assert.ok(helper.includes('shown: false'))
    assert.ok(helper.includes('window.setTimeout'))
  })

  it('treats a non-focused Electron window as background', () => {
    const overlay = source('overlay.ts')
    assert.ok(overlay.includes('function isBackgroundWindow'))
    assert.ok(overlay.includes('document.hasFocus() === false'))
    assert.ok(overlay.includes("window.addEventListener('blur'"))
    assert.ok(overlay.includes("window.addEventListener('focus'"))
  })
})
