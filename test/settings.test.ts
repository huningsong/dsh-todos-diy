/**
 * N0: Settings.desktopNotifications + schema v3→v4.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { migrateDocumentToCurrent, migrateIndexToCurrent } from '../src/host/migrationV3.js'
import { coerceSettings, defaultSettings } from '../src/host/state.js'
import { buildTask } from '../src/host/repoBuild.js'
import { validateSettingsPatch } from '../src/host/validateSettings.js'

describe('N0: desktopNotifications setting', () => {
  it('defaults to off', () => {
    assert.deepEqual(defaultSettings().desktopNotifications, { enabled: false })
    assert.deepEqual(coerceSettings({}).desktopNotifications, { enabled: false })
  })

  it('coerces an enabled flag', () => {
    assert.deepEqual(coerceSettings({ desktopNotifications: { enabled: true } }).desktopNotifications, { enabled: true })
    assert.deepEqual(coerceSettings({ desktopNotifications: { enabled: 'yes' } }).desktopNotifications, { enabled: false })
  })

  it('validates a partial settings patch', () => {
    assert.deepEqual(validateSettingsPatch({ desktopNotifications: { enabled: true } }).desktopNotifications, { enabled: true })
    assert.throws(() => validateSettingsPatch({ desktopNotifications: true }), /desktopNotifications must be an object/)
    assert.throws(
      () => validateSettingsPatch({ desktopNotifications: { enabled: 'true' } }),
      /desktopNotifications\.enabled must be a boolean/,
    )
  })


  it('forces new tasks to overlay-only channels', () => {
    const task = buildTask(
      {
        title: 'x',
        kind: 'once',
        once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
        notify: { channels: ['overlay', 'system'] },
      },
      defaultSettings(),
      new Date('2026-11-05T12:00:00+08:00'),
    )
    assert.deepEqual(task.notify.channels, ['overlay'])
  })

  it('adds the field in v3→v4 document migration', () => {
    const migrated = migrateDocumentToCurrent({ schemaVersion: 3, settings: { timeZone: 'Asia/Shanghai' }, tasks: [] })
    assert.equal(migrated['schemaVersion'], 4)
    assert.deepEqual((migrated['settings'] as Record<string, unknown>)['desktopNotifications'], { enabled: false })
  })

  it('migrates an archive index from v1 to v4', () => {
    const migrated = migrateIndexToCurrent({ schemaVersion: 1, quarters: [] })
    assert.equal(migrated['schemaVersion'], 4)
  })
})
