/**
 * UX-19: every group shows at most five rows until the user expands it.
 *
 * The list itself is React, so the paging rule lives in a pure helper and is
 * covered here; the rendering component is asserted at source level.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { GROUP_PAGE_SIZE, visibleGroupItems } from '../src/client/grouping.js'
import { zh } from '../src/client/dictionary-zh.js'
import { en } from '../src/client/dictionary-en.js'

const here = dirname(fileURLToPath(import.meta.url))
const clientSource = (name: string): string => readFileSync(join(here, '../../src/client', name), 'utf8')

describe('UX-19: group paging', () => {
  it('shows groups of five or fewer in full', () => {
    assert.deepEqual(visibleGroupItems([1, 2, 3, 4, 5], false), [1, 2, 3, 4, 5])
  })

  it('shows only the first five rows until expanded', () => {
    assert.equal(GROUP_PAGE_SIZE, 5)
    assert.deepEqual(visibleGroupItems([1, 2, 3, 4, 5, 6, 7], false), [1, 2, 3, 4, 5])
  })

  it('shows every row when expanded', () => {
    assert.deepEqual(visibleGroupItems([1, 2, 3, 4, 5, 6, 7], true), [1, 2, 3, 4, 5, 6, 7])
  })

  it('has show-more/show-less labels in both languages', () => {
    assert.equal((zh as Record<string, string>)['group.showMore'], '展开剩余 {n} 条')
    assert.equal((zh as Record<string, string>)['group.showLess'], '收起')
    assert.equal((en as Record<string, string>)['group.showMore'], 'Show {n} more')
    assert.equal((en as Record<string, string>)['group.showLess'], 'Show less')
  })

  it('renders the collapse control from the shared component', () => {
    const source = clientSource('list-collapse.ts')
    assert.ok(source.includes('visibleGroupItems(items, expanded)'))
    assert.ok(source.includes("t('group.showMore', { n: hidden })"))
    assert.ok(source.includes("t('group.showLess')"))
    assert.ok(clientSource('task-list.ts').includes('CollapsibleRows'))
    assert.ok(clientSource('archive-view.ts').includes('CollapsibleRows'))
  })
})

describe('FIX-07/FIX-08: third-round list polish', () => {
  it('does not show a next-run line for one-off tasks', () => {
    const source = clientSource('task-row.ts')
    assert.ok(source.includes("task.kind === 'recurring'"))
    assert.ok(source.includes("t('task.nextAt'"))
  })

  it('distinguishes no search matches from an empty view', () => {
    const list = clientSource('task-list.ts')
    assert.ok(list.includes("t('empty.noMatch'"))
    assert.ok(list.includes('onClearSearch'))
    assert.equal((zh as Record<string, string>)['empty.noMatch'], '没有找到匹配“{query}”的任务')
    assert.equal((en as Record<string, string>)['empty.noMatch'], 'No tasks match “{query}”')
  })
})

describe('UX-20: completion button is recognizable', () => {
  it('renders a check glyph and a visible hover title', () => {
    const row = clientSource('task-row.ts')
    assert.ok(row.includes('CheckGlyph'))
    assert.ok(row.includes("t('task.complete')"))
    assert.ok(clientSource('ui.ts').includes('CheckGlyph'))
  })

  it('styles the check circle as an actionable control', () => {
    const styles = clientSource('styles.ts')
    assert.ok(styles.includes('.dtd-check{'))
    assert.ok(styles.includes('justify-content:center'))
    assert.ok(styles.includes('state-business-tertiary'))
  })
})

describe('UX-21: pin is discoverable from the more menu', () => {
  it('adds a state-aware pin item to the task menu', () => {
    const menu = clientSource('panel-menu.ts')
    assert.ok(menu.includes("props.task.pinned ? t('task.unpin') : t('task.pin')"))
    assert.ok(menu.includes('onPin'))
  })

  it('wires the menu pin action to the same mutation as the row shortcut', () => {
    const panel = clientSource('panel.ts')
    assert.ok(panel.includes('onPin:'))
    assert.ok(panel.includes('api.pin(menu.task.id'))
  })
})

describe('F8.9/F8.20: group expansion with pagination', () => {
  it('defaults groups open for paginated lists and remembers manual choices', () => {
    const collapse = clientSource('list-collapse.ts')
    assert.ok(collapse.includes('defaultExpanded'))
    assert.ok(collapse.includes('storageKey'))
    assert.ok(collapse.includes('localStorage'))
    const list = clientSource('task-list.ts')
    assert.ok(list.includes('defaultExpanded: props.hasMore === true'))
    assert.ok(list.includes('storageKey: `dsh-todos-diy.group.'))
  })
})
