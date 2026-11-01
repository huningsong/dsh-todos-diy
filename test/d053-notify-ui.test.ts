/**
 * System-notification discoverability in the task editor (F5.9 / UX-25).
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

describe('system notification discoverability', () => {
  it('reads the current permission and renders a status hint', () => {
    const editor = source('task-editor.ts')
    assert.ok(editor.includes('getNotificationPermission'))
    assert.ok(editor.includes('dtd-notifyStatus'))
    assert.ok(editor.includes('form.notify.systemStatus'))
  })

  it('updates the status after requesting permission on save', () => {
    const editor = source('task-editor.ts')
    assert.ok(editor.includes('const permission = await requestNotificationPermission()'))
    assert.ok(editor.includes('setSystemNotification(permission)'))
  })

  it('shows a non-blocking notice when permission is not granted', () => {
    const editor = source('task-editor.ts')
    assert.ok(editor.includes("permission !== 'granted'"))
    assert.ok(editor.includes('onNotice'))
    assert.ok(source('panel.ts').includes('onNotice: (message) => showToast(message)'))
  })

  it('has all permission states in both languages', () => {
    const keys = ['granted', 'default', 'denied', 'unsupported']
    for (const key of keys) {
      assert.ok((zh as Record<string, string>)[`form.notify.systemStatus.${key}`])
      assert.ok((en as Record<string, string>)[`form.notify.systemStatus.${key}`])
    }
  })
})

describe('system notification diagnostics', () => {
  it('offers an explicit test notification action', () => {
    assert.ok(source('notify-permission.ts').includes('sendTestNotification'))
    assert.ok(source('task-editor.ts').includes("t('form.notify.test')"))
    assert.ok(source('task-editor.ts').includes('testSystemNotification'))
  })

  it('waits for onshow before reporting a system delivery as OK', () => {
    const overlay = source('overlay.ts')
    assert.ok(overlay.includes('notification.onshow'))
    assert.ok(overlay.includes('notification.onerror'))
    assert.ok(overlay.includes("report(false, 'no-show-event')"))
  })
})

describe('cross-platform notification permission guidance', () => {
  it('has mac, windows and fallback guidance in both languages', () => {
    for (const platform of ['mac', 'windows', 'other']) {
      assert.ok((zh as Record<string, string>)[`form.notify.guide.${platform}`])
      assert.ok((en as Record<string, string>)[`form.notify.guide.${platform}`])
    }
  })

  it('renders platform guidance in the editor and settings', () => {
    assert.ok(source('task-editor.ts').includes('form.notify.guide'))
    assert.ok(source('settings-modal.ts').includes('form.notify.guide'))
    assert.ok(source('notify-permission.ts').includes('getNotificationPlatform'))
  })

  it('does not claim the test was shown until onshow fires', () => {
    const helper = source('notify-permission.ts')
    assert.ok(helper.includes('notification.onshow'))
    assert.ok(helper.includes('shown: false'))
    assert.ok(helper.includes('window.setTimeout'))
  })
})

describe('minimized-window notification detection', () => {
  it('treats a non-focused Electron window as background', () => {
    const overlay = source('overlay.ts')
    assert.ok(overlay.includes('function isBackgroundWindow'))
    assert.ok(overlay.includes('document.hasFocus() === false'))
    assert.ok(overlay.includes("window.addEventListener('blur'"))
    assert.ok(overlay.includes("window.addEventListener('focus'"))
  })
})
