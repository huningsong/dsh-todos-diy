/**
 * Browser notification permission (F9.3 / UX-12).
 *
 * Permission is requested only when the user actually saves a task that uses
 * the system channel — never on mount, where a reflex "deny" would permanently
 * disable notifications for this origin.
 */

/**
 * Ask the browser for the Notification permission, once, and report the result
 * to the host so `/health` can answer AC-15 truthfully.
 * @returns Nothing; a refusal is not an error (the overlay still works).
 */
export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') {
    await reportCapability(Notification.permission === 'granted')
    return
  }
  try {
    const result = await Notification.requestPermission()
    await reportCapability(result === 'granted')
  } catch {
    await reportCapability(false)
  }
}

/**
 * Report the current Notification capability to the host.
 * @param granted - Whether the permission is granted.
 */
async function reportCapability(granted: boolean): Promise<void> {
  try {
    await fetch('/api/dsh-todos-diy/capabilities', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemNotification: granted }),
    })
  } catch {
    // Best effort: a failed report must never block saving the task.
  }
}
