import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_FILE_SIZE_MB,
  type ClaimKind,
  type ClaimReportContentJson,
} from '@mr/shared'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { StarterKit } from '@tiptap/starter-kit'
import { Selection } from '@tiptap/extensions'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ArrowLeftIcon } from '~/components/tiptap/tiptap-icons/arrow-left-icon'
import { HighlighterIcon } from '~/components/tiptap/tiptap-icons/highlighter-icon'
import { LinkIcon } from '~/components/tiptap/tiptap-icons/link-icon'
import { HorizontalRule } from '~/components/tiptap/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { ImageUploadNode } from '~/components/tiptap/tiptap-node/image-upload-node/image-upload-node-extension'
import { BlockquoteButton } from '~/components/tiptap/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '~/components/tiptap/tiptap-ui/code-block-button'
import {
  ColorHighlightPopover,
  ColorHighlightPopoverButton,
  ColorHighlightPopoverContent,
} from '~/components/tiptap/tiptap-ui/color-highlight-popover'
import { HeadingDropdownMenu } from '~/components/tiptap/tiptap-ui/heading-dropdown-menu'
import { ImageUploadButton } from '~/components/tiptap/tiptap-ui/image-upload-button'
import { LinkButton, LinkContent, LinkPopover } from '~/components/tiptap/tiptap-ui/link-popover'
import { ListDropdownMenu } from '~/components/tiptap/tiptap-ui/list-dropdown-menu'
import { MarkButton } from '~/components/tiptap/tiptap-ui/mark-button'
import { TextAlignButton } from '~/components/tiptap/tiptap-ui/text-align-button'
import { UndoRedoButton } from '~/components/tiptap/tiptap-ui/undo-redo-button'
import { Button } from '~/components/tiptap/tiptap-ui-primitive/button'
import { Spacer } from '~/components/tiptap/tiptap-ui-primitive/spacer'
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '~/components/tiptap/tiptap-ui-primitive/toolbar'
import { useCursorVisibility } from '~/hooks/use-cursor-visibility'
import { useIsBreakpoint } from '~/hooks/use-is-breakpoint'
import { useWindowSize } from '~/hooks/use-window-size'

import { uploadClaimReportImage } from './upload-claim-report-image.js'

import '~/components/tiptap/tiptap-node/blockquote-node/blockquote-node.scss'
import '~/components/tiptap/tiptap-node/code-block-node/code-block-node.scss'
import '~/components/tiptap/tiptap-node/heading-node/heading-node.scss'
import '~/components/tiptap/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'
import '~/components/tiptap/tiptap-node/image-node/image-node.scss'
import '~/components/tiptap/tiptap-node/list-node/list-node.scss'
import '~/components/tiptap/tiptap-node/paragraph-node/paragraph-node.scss'
import '~/components/tiptap/tiptap-node/image-upload-node/image-upload-node.scss'
import './claim-report-editor.scss'

const REPORT_IMAGE_MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const REPORT_IMAGE_ACCEPT = ALLOWED_IMAGE_MIME_TYPES.join(',')

export interface ClaimReportEditorProps {
  initialContent: ClaimReportContentJson
  editable: boolean
  claimKind: ClaimKind
  claimId: string
  /**
   * Persist the current content. Called on blur and on unmount (sheet close)
   * only — never per keystroke — so editing is never interrupted. `onUpdate`
   * just marks the document dirty; the full getJSON/getHTML serialization runs
   * once, at persist time, and only when there are unsaved changes.
   */
  onPersist: (payload: { contentJson: ClaimReportContentJson; contentHtml: string }) => void
}

interface MainToolbarContentProps {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
}

function MainToolbarContent({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: MainToolbarContentProps): React.ReactElement {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu modal={false} types={['bulletList', 'orderedList', 'taskList']} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <Spacer />
    </>
  )
}

interface MobileToolbarContentProps {
  type: 'highlighter' | 'link'
  onBack: () => void
}

function MobileToolbarContent({ type, onBack }: MobileToolbarContentProps): React.ReactElement {
  return (
    <>
      <ToolbarGroup>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeftIcon className="tiptap-button-icon" />
          {type === 'highlighter' ? (
            <HighlighterIcon className="tiptap-button-icon" />
          ) : (
            <LinkIcon className="tiptap-button-icon" />
          )}
        </Button>
      </ToolbarGroup>

      <ToolbarSeparator />

      {type === 'highlighter' ? <ColorHighlightPopoverContent /> : <LinkContent />}
    </>
  )
}

export default function ClaimReportEditor({
  initialContent,
  editable,
  claimKind,
  claimId,
  onPersist,
}: ClaimReportEditorProps): React.ReactElement {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<'main' | 'highlighter' | 'link'>('main')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)

  const handleImageUpload = useCallback(
    async (
      file: File,
      onProgress?: (event: { progress: number }) => void,
      abortSignal?: AbortSignal,
    ): Promise<string> => {
      const result = await uploadClaimReportImage({
        claimKind,
        claimId,
        file,
        ...(abortSignal !== undefined ? { signal: abortSignal } : {}),
        onProgress: (loaded, total) => {
          if (total > 0) {
            onProgress?.({ progress: Math.round((loaded / total) * 100) })
          }
        },
      })

      return result.url
    },
    [claimId, claimKind],
  )

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image.configure({
        resize: {
          enabled: true,
          directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
          minWidth: 80,
          minHeight: 80,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: REPORT_IMAGE_ACCEPT,
        maxSize: REPORT_IMAGE_MAX_BYTES,
        limit: 3,
        upload: handleImageUpload,
      }),
    ],
    [handleImageUpload],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: initialContent,
    extensions,
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        'aria-label': 'Sadržaj izveštaja o reklamaciji',
        class: 'claim-report-editor tiptap',
      },
    },
    onUpdate: () => {
      // Cheap per-keystroke marker only — no serialization here. The full
      // getJSON/getHTML runs once, at persist time (blur/unmount).
      dirtyRef.current = true
    },
  })

  useEffect(() => {
    if (editor === null) {
      return
    }

    // Persist on blur and on unmount (sheet close) — the only two moments, so
    // typing never triggers a save/remount. Skips when nothing changed.
    const persist = (): void => {
      if (!dirtyRef.current || editor.isDestroyed) {
        return
      }
      dirtyRef.current = false
      onPersist({
        contentJson: editor.getJSON() as ClaimReportContentJson,
        contentHtml: editor.getHTML(),
      })
    }

    editor.on('blur', persist)
    return () => {
      editor.off('blur', persist)
      persist()
    }
  }, [editor, onPersist])

  useEffect(() => {
    if (editor === null) {
      return
    }

    editor.setEditable(editable)
  }, [editor, editable])

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  useEffect(() => {
    if (!isMobile && mobileView !== 'main') {
      setMobileView('main')
    }
  }, [isMobile, mobileView])

  // Stable provider value — an inline object would re-render the whole
  // toolbar tree on every keystroke.
  const editorContextValue = useMemo(() => ({ editor }), [editor])

  return (
    <div className="claim-report-editor-wrapper" data-testid="claim-report-editor">
      <EditorContext.Provider value={editorContextValue}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === 'main' ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView('highlighter')}
              onLinkClick={() => setMobileView('link')}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === 'highlighter' ? 'highlighter' : 'link'}
              onBack={() => setMobileView('main')}
            />
          )}
        </Toolbar>

        <EditorContent editor={editor} role="presentation" className="simple-editor-content" />
      </EditorContext.Provider>
    </div>
  )
}
