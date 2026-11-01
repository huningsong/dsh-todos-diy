/**
 * "快捷功能说明" dialog for the two opt-in capabilities that users cannot
 * infer from the task list: natural-language quick add and system notifications
 * (F8.19 / UX-29). The entry lives in the panel header, not in the task list.
 */

import * as React from 'react'

import { getNotificationPlatform } from './notify-permission'
import { Modal } from './ui'

const h = React.createElement

/** Props for the feature guide dialog. */
export interface FeatureHintsProps {
  t: (key: string, params?: Record<string, string | number>) => string
  nlpEnabled: boolean
  onOpenSettings: () => void
  onClose: () => void
}

/** A modal explaining the two opt-in features. */
export function FeatureHints(props: FeatureHintsProps): React.ReactNode {
  const { t } = props
  const platform = getNotificationPlatform()
  return h(
    Modal,
    {
      title: t('featureHints.title'),
      onClose: props.onClose,
      footer: [
        h(
          'button',
          { key: 'settings', type: 'button', className: 'dtd-btn', onClick: props.onOpenSettings },
          t('featureHints.openSettings'),
        ),
        h(
          'button',
          { key: 'close', type: 'button', className: 'dtd-btn ghost', onClick: props.onClose },
          t('featureHints.close'),
        ),
      ],
    },
    h(
      'div',
      { className: 'dtd-featureHintsItems' },
      h(
        'div',
        { className: 'dtd-featureHintItem' },
        h('b', null, '✨ ', t('featureHints.nlp')),
        h('span', null, t(props.nlpEnabled ? 'featureHints.nlpHintOn' : 'featureHints.nlpHint')),
        props.nlpEnabled ? h('span', { className: 'dtd-featureHintState' }, t('featureHints.nlpOn')) : null,
      ),
      h(
        'div',
        { className: 'dtd-featureHintItem' },
        h('b', null, '🔔 ', t('featureHints.system')),
        h('span', null, t(`form.notify.guide.${platform}`)),
      ),
    ),
  )
}
