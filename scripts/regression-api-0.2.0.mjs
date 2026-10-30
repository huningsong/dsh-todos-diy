/**
 * 0.2.0 regression R-01, R-05..R-15 — real HTTP + lib blackbox.
 */
// Usage: BASE=http://127.0.0.1:<port> COOKIE='<cookie>' node scripts/regression-api-0.2.0.mjs
// Requires a running DSH instance with this plugin installed.
const REPO = process.env.PLUGIN_DIR ?? process.cwd()
const BASE = process.env.BASE ?? 'http://127.0.0.1:53970'
const API = `${BASE}/api/dsh-todos-diy`
const cookie = process.env.COOKIE ?? ''
const results = []
const record = (id, ok, detail) => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`) }
async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) } })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}
const create = (body) => req('/tasks/create', { method: 'POST', body: JSON.stringify(body) })

// R-01
{
  const r = await req('/health'); const v = r.json?.value
  record('R-01', r.status === 200 && v?.version === '0.2.0' && v?.scheduler?.running === true && v?.capabilities?.agentTools === 9,
    `version=${v?.version} running=${v?.scheduler?.running} agentTools=${v?.capabilities?.agentTools}`)
}
// R-05
{
  const bad = await create({ title: 'legacy', kind: 'recurring', dueDate: '2026-11-03', rule: { preset: 'workdays', time: '09:00' } })
  const good = await create({ title: 'R05 task', kind: 'once', once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' } })
  const v = good.json?.value
  record('R-05', bad.status === 400 && bad.json?.error?.code === 'invalid_argument' && good.status === 201 && ['notStarted', 'inProgress'].includes(v?.stage) && typeof v?.priority?.remainingMinutes === 'number' && !Object.hasOwn(v ?? {}, 'dueDate'),
    `dueDate=${bad.status}/${bad.json?.error?.code} created=${good.status} stage=${v?.stage}`)
}
// R-06
{
  const r = await create({ title: 'R06 created start', kind: 'once', once: { endAt: '2026-11-06T18:00:00+08:00' } })
  const v = r.json?.value
  record('R-06', r.status === 201 && v?.once?.startAtSource === 'created' && v?.once?.startAt === v?.createdAt && v?.state?.firedStart === true,
    `status=${r.status} source=${v?.once?.startAtSource} startAt===createdAt:${v?.once?.startAt === v?.createdAt} firedStart=${v?.state?.firedStart}`)
}
// R-08 stage boundary via the same pure functions the host uses
{
  const { stageOf } = await import(`${REPO}/lib/rules/priority.js`)
  const task = { id: 't', title: 't', description: '', kind: 'once', status: 'active', pinned: false, doneAt: null, archivedQuarter: null,
    rule: null, once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00', startAtSource: 'explicit', timeZone: 'Asia/Shanghai' },
    notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 0, sound: false, endReminder: true },
    state: { lastFiredAt: null, lastOccurrenceKey: null, firedStart: false, firedEnd: false, firedStartAdvance: false, firedEndAdvance: false, missedStart: false, missedEnd: false, missedAt: null, missedCount: 0, snoozeUntil: null, completedOccurrenceKey: null },
    revision: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
  const at = (iso) => new Date(iso)
  const stages = [
    stageOf(task, at('2026-11-05T13:59:59.999+08:00')),
    stageOf(task, at('2026-11-05T14:00:00.000+08:00')),
    stageOf(task, at('2026-11-05T18:00:00.999+08:00')),
    stageOf(task, at('2026-11-05T18:00:01.000+08:00')),
  ]
  record('R-08', JSON.stringify(stages) === JSON.stringify(['notStarted', 'inProgress', 'inProgress', 'overdue']), JSON.stringify(stages))
}
// R-09 / R-10 seed a known dataset
{
  // clear any tasks created above is not needed; build counts relative
  const before = (await req('/snapshot?view=inProgress')).json?.value?.counts
  const plan = [
    { title: 'n1', kind: 'once', once: { startAt: '2026-11-06T09:00:00+08:00', endAt: '2026-11-06T18:00:00+08:00' } },
    { title: 'p1', kind: 'once', once: { startAt: '2026-10-30T09:00:00+08:00', endAt: '2026-10-30T23:00:00+08:00' } },
    { title: 'p2', kind: 'once', once: { startAt: '2026-10-29T09:00:00+08:00', endAt: '2026-11-01T23:00:00+08:00' } },
    { title: 'o1', kind: 'once', once: { startAt: '2026-10-01T09:00:00+08:00', endAt: '2026-10-02T18:00:00+08:00' } },
    { title: 'r1', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } },
  ]
  const ids = []
  for (const body of plan) ids.push((await create(body)).json?.value?.id)
  const pauseId = (await create({ title: 'z1', kind: 'once', once: { startAt: '2026-10-01T09:00:00+08:00', endAt: '2026-10-02T18:00:00+08:00' } })).json?.value?.id
  await req('/tasks/pause', { method: 'POST', body: JSON.stringify({ id: pauseId }) })
  const s = (await req('/snapshot?view=inProgress')).json?.value
  const expected = { notStarted: (before?.notStarted ?? 0) + 1, inProgress: (before?.inProgress ?? 0) + 2, overdue: (before?.overdue ?? 0) + 1, paused: (before?.paused ?? 0) + 1, recurring: (before?.recurring ?? 0) + 1 }
  const ok9 = s.counts.notStarted === expected.notStarted && s.counts.inProgress === expected.inProgress && s.counts.overdue === expected.overdue && s.counts.paused === expected.paused && s.counts.recurring === expected.recurring
  record('R-09', ok9, `counts=${JSON.stringify(s.counts)} expected~${JSON.stringify(expected)}`)
  // R-10 counts unaffected by filters
  const filtered = (await req('/snapshot?view=inProgress&status=paused&q=zzz')).json?.value
  record('R-10', JSON.stringify(filtered.counts) === JSON.stringify(s.counts) && filtered.byKind && typeof filtered.totalDone === 'number' && filtered.serverTime,
    `countsStable=${JSON.stringify(filtered.counts) === JSON.stringify(s.counts)} byKind=${JSON.stringify(filtered.byKind)} totalDone=${filtered.totalDone}`)
  // R-12 recurring complete without occurrence -> no_occurrence
  const rid = (await create({ title: 'R12 fresh recurring', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })).json?.value?.id
  const comp = await req('/tasks/complete', { method: 'POST', body: JSON.stringify({ id: rid }) })
  const compTask = (await req(`/tasks/get?id=${rid}`)).json?.value
  record('R-12', (comp.status === 409 || comp.status === 400) && comp.json?.error?.code === 'no_occurrence' && compTask?.status === 'active',
    `complete=${comp.status}/${comp.json?.error?.code} status=${compTask?.status}`)
}
// R-11 priority boundaries via lib
{
  const { derivePriorityFromRemaining } = await import(`${REPO}/lib/rules/priority.js`)
  const H = 3_600_000
  const got = [24*H, 24*H+60_000, 72*H, 72*H+60_000, 168*H, 168*H+60_000, -1].map((ms) => derivePriorityFromRemaining(ms).key)
  record('R-11', JSON.stringify(got) === JSON.stringify(['high','mid','mid','low','low','none','high']), JSON.stringify(got))
}
// R-13 tool count / schema
{
  const { createToolDefinitions } = await import(`${REPO}/lib/toolDefs.js`)
  const { createRepository } = await import(`${REPO}/lib/repo.js`)
  const { createStore } = await import(`${REPO}/lib/store.js`)
  const defs = createToolDefinitions({ repo: {}, holidays: undefined, timeZone: 'Asia/Shanghai', now: () => new Date() })
  const list = defs.find((d) => d.name === 'todo_reminder_list')
  const del = defs.find((d) => d.name === 'todo_reminder_delete')
  const viewEnum = list?.parameters?.properties?.view?.enum
  record('R-13', defs.length === 9 && !('dueDate' in (list?.parameters?.properties ?? {})) && Array.isArray(viewEnum) && viewEnum.length === 6 && 'confirm' in (del?.parameters?.properties ?? {}),
    `tools=${defs.length} viewEnum=${JSON.stringify(viewEnum)} confirm=${'confirm' in (del?.parameters?.properties ?? {})}`)
}
// R-14 remind + deliveries
{
  const t = (await create({ title: 'R14 remind', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })).json?.value
  const before = t.state
  const r = await req('/tasks/remind', { method: 'POST', body: JSON.stringify({ id: t.id }) })
  const g = (await req(`/tasks/get?id=${t.id}`)).json?.value
  const d = (await req(`/deliveries?taskId=${t.id}`)).json?.value
  record('R-14', r.status === 200 && r.json?.value?.occurrenceKey?.endsWith('#remind') && g.state.lastOccurrenceKey === before.lastOccurrenceKey && g.state.firedStart === before.firedStart && d.total >= 1,
    `remind=${r.status} key=${r.json?.value?.occurrenceKey?.slice(-8)} ruleStateUnchanged=${g.state.lastOccurrenceKey === before.lastOccurrenceKey} deliveries=${d?.total}`)
}
// R-15 purge confirm
{
  const t = (await create({ title: 'R15 purge', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })).json?.value
  const no = await req('/tasks/delete', { method: 'POST', body: JSON.stringify({ id: t.id, purge: true }) })
  const still = await req(`/tasks/get?id=${t.id}`)
  const yes = await req('/tasks/delete', { method: 'POST', body: JSON.stringify({ id: t.id, purge: true, confirm: true }) })
  record('R-15', no.status === 400 && no.json?.error?.code === 'invalid_argument' && still.status === 200 && yes.status === 200 && yes.json?.value?.purged === true,
    `noConfirm=${no.status}/${no.json?.error?.code} stillThere=${still.status} confirmed=${yes.status}/${yes.json?.value?.purged}`)
}
console.log('SUMMARY', JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: results.filter((r) => !r.ok).map((r) => r.id) }))
