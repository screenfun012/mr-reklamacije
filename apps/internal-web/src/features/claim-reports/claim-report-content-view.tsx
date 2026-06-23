import { sanitizeClaimReportHtml } from './sanitize-claim-report-html.js'

import '~/components/tiptap/tiptap-node/blockquote-node/blockquote-node.scss'
import '~/components/tiptap/tiptap-node/code-block-node/code-block-node.scss'
import '~/components/tiptap/tiptap-node/heading-node/heading-node.scss'
import '~/components/tiptap/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'
import '~/components/tiptap/tiptap-node/image-node/image-node.scss'
import '~/components/tiptap/tiptap-node/list-node/list-node.scss'
import '~/components/tiptap/tiptap-node/paragraph-node/paragraph-node.scss'
import './claim-report-content-view.scss'

export interface ClaimReportContentViewProps {
  contentHtml: string
}

export function ClaimReportContentView({
  contentHtml,
}: ClaimReportContentViewProps): React.ReactElement {
  const safeHtml = sanitizeClaimReportHtml(contentHtml)

  return (
    <article
      id="claim-report-print-root"
      className="claim-report-content-view tiptap ProseMirror"
      data-testid="claim-report-content-view"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
