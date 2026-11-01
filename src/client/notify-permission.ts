/**
 * Browser notification permission (F9.3 / UX-12).
 *
 * Permission is requested only when the user actually saves a task that uses
 * the system channel — never on mount, where a reflex "deny" would permanently
 * disable notifications for this origin.
 */

export type SystemNotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Read the current browser Notification permission without prompting.
 * @returns The current permission state; `unsupported` when the browser has no Notification API.
 */
export function getNotificationPermission(): SystemNotificationStatus {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'default'
}

/**
 * Ask the browser for the Notification permission, once, and report the result
 * to the host so `/health` can answer AC-15 truthfully.
 * @returns The resulting permission state; a refusal is not an error (the overlay still works).
 */
export async function requestNotificationPermission(): Promise<SystemNotificationStatus> {
  const current = getNotificationPermission()
  if (current !== 'default') {
    await reportCapability(current === 'granted')
    return current
  }
  try {
    const result = await Notification.requestPermission()
    await reportCapability(result === 'granted')
    return result === 'granted' ? 'granted' : 'denied'
  } catch {
    await reportCapability(false)
    return 'denied'
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


/** Platform family used for permission-setting guidance. */
export type NotificationPlatform = 'mac' | 'windows' | 'other'

/**
 * Detect the desktop platform family for notification settings guidance.
 * @returns `mac`, `windows`, or `other`.
 */
export function getNotificationPlatform(): NotificationPlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac') || ua.includes('darwin')) return 'mac'
  if (ua.includes('win') || ua.includes('windows')) return 'windows'
  return 'other'
}

/** Result of an explicit OS-level notification test. */
export interface TestNotificationResult {
  /** Browser permission at test time. */
  status: SystemNotificationStatus
  /** Whether the browser fired an onshow event. */
  shown: boolean
}

/**
 * Show a test system notification so the user can verify OS-level delivery.
 * The browser permission is requested first (only from this explicit click).
 * @param title - Test notification title.
 * @param body - Test notification body.
 * @returns Permission status and whether the OS actually showed the notification.
 */
export async function sendTestNotification(title: string, body: string): Promise<TestNotificationResult> {
  const status = await requestNotificationPermission()
  if (status !== 'granted') return { status, shown: false }
  try {
    const notification = new Notification(title, { body, tag: 'dsh-todos-diy:test' })
    return await new Promise<TestNotificationResult>((resolve) => {
      let settled = false
      const finish = (shown: boolean): void => {
        if (settled) return
        settled = true
        resolve({ status, shown })
      }
      notification.onshow = () => finish(true)
      notification.onerror = () => finish(false)
      window.setTimeout(() => finish(false), 3000)
    })
  } catch {
    return { status: 'unsupported', shown: false }
  }
}
