import { m } from '@mr/i18n'
import type { IntakeChecklistItemListItem, IntakeOrderDetail } from '@mr/shared'
import type { ReactElement } from 'react'

import { HANDOVER_STYLE } from './intake-handover-styles.js'
import { formatIntakeReceivedAtLong } from './intake-document-locale.js'
import { INTAKE_DAMAGE_TYPE_LABELS } from './intake-labels.js'
import { IntakePrintBasics } from './intake-print-basics.js'
import { IntakePrintCondition } from './intake-print-condition.js'
import { IntakePrintHeader } from './intake-print-header.js'
import { IntakePrintSignatureBox } from './intake-print-signature-box.js'
import {
  buildIntakePrintModel,
  type IntakePrintLocale,
  type IntakePrintModel,
} from './intake-print-data.js'
import { PRINT_BAND, PRINT_EYEBROW } from './intake-print-styles.js'

const DEFAULT_SHEET_ID = 'intake-handover-sheet'

/**
 * A list that prints ALL of its rows. No cut, no "…and N more": the work order can say that because
 * it is one page by rule and the digital order is one click away, but this paper is the answer to
 * "what did you do to my car" (`docs/25` §3.5) — and an answer with something left off it is the
 * first thing a dissatisfied owner reaches for.
 */
function HandoverList({ items }: { items: readonly string[] }): ReactElement {
  return (
    <div style={HANDOVER_STYLE.block}>
      {items.map((item, index) => (
        <div key={`${index}-${item}`} style={HANDOVER_STYLE.row}>
          <span style={HANDOVER_STYLE.rowNumber}>{index + 1}</span>
          <span style={HANDOVER_STYLE.rowText}>{item}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The defects, quoted from what was recorded at intake. No silhouette: the drawing is document 1's,
 * the owner has it, and a second copy of it here would be a second place for the two papers to
 * disagree. The NUMBERS are document 1's numbering, which is exactly what makes them worth printing —
 * they are how a row here is found on the drawing there.
 */
function HandoverDefects({
  order,
  locale,
}: {
  order: IntakeOrderDetail
  locale: IntakePrintLocale
}): ReactElement {
  return (
    <div style={HANDOVER_STYLE.block}>
      <div style={PRINT_EYEBROW}>{m.intake_print_section_defects({}, { locale })}</div>
      {order.damages.length === 0 && order.extraDamages.length === 0 ? (
        <div style={HANDOVER_STYLE.empty}>{m.intake_print_no_damage({}, { locale })}</div>
      ) : null}
      {order.damages.map((damage, index) => (
        <div key={damage.id} style={HANDOVER_STYLE.row}>
          <span style={HANDOVER_STYLE.rowNumber}>{index + 1}</span>
          <span style={HANDOVER_STYLE.rowText}>
            {INTAKE_DAMAGE_TYPE_LABELS[damage.type]({}, { locale })}
          </span>
          <span style={HANDOVER_STYLE.rowZone}>{damage.zone}</span>
        </div>
      ))}
      {/* Written-in defects carry no number, for the same reason they carry none on the work order:
          a number on this paper points at the drawing, and these have no place on it. */}
      {order.extraDamages.map((text, index) => (
        <div key={`${index}-${text}`} style={HANDOVER_STYLE.row}>
          <span style={HANDOVER_STYLE.rowNumber} />
          <span style={HANDOVER_STYLE.rowText}>{text}</span>
        </div>
      ))}
    </div>
  )
}

/** Everything the owner already signed for once, so the two papers can be read side by side. */
function HandoverReceived({
  model,
  order,
}: {
  model: IntakePrintModel
  order: IntakeOrderDetail
}): ReactElement {
  return (
    <section>
      <div style={PRINT_BAND}>
        {m.intake_handover_section_received({}, { locale: model.locale })}
      </div>
      <div style={HANDOVER_STYLE.block}>
        <IntakePrintBasics model={model} />
      </div>
      <div style={HANDOVER_STYLE.block}>
        <IntakePrintCondition model={model} />
      </div>
      <HandoverDefects order={order} locale={model.locale} />
    </section>
  )
}

/** What was done, and what went into it. */
function HandoverWork({
  order,
  locale,
}: {
  order: IntakeOrderDetail
  locale: IntakePrintLocale
}): ReactElement {
  const nothingRecorded = order.services.length === 0 && order.materials.length === 0

  return (
    <>
      <section style={HANDOVER_STYLE.section}>
        <div style={PRINT_BAND}>{m.intake_handover_section_services({}, { locale })}</div>
        {order.services.length === 0 ? null : <HandoverList items={order.services} />}
        {/* ONE sentence, for both lists. Printed twice it would read as two different absences, and
            there is only one: nothing was recorded as done. */}
        {nothingRecorded ? (
          <div style={HANDOVER_STYLE.empty}>{m.intake_handover_no_work({}, { locale })}</div>
        ) : null}
      </section>

      {/* No band over an empty list: the sentence above has already said nothing was recorded, and a
          heading with a void under it invites the question of what was left off. */}
      {order.materials.length === 0 ? null : (
        <section style={HANDOVER_STYLE.section}>
          <div style={PRINT_BAND}>{m.intake_handover_section_materials({}, { locale })}</div>
          <HandoverList items={order.materials} />
        </section>
      )}
    </>
  )
}

/**
 * The handover record — document 2, and the one that flows.
 *
 * It carries everything document 1 carried plus everything that happened after it (spec §5), so the
 * two can be read side by side: same header band, same owner and vehicle block, same condition, and
 * then the work. Photographs stay off it, as they stayed off document 1 (decision ⑦).
 *
 * The header band prints on page one and on no other — measured, with what that costs and what it
 * would take to change, in `INTAKE_HANDOVER_PAGE_CSS`.
 */
export function IntakeHandoverSheet({
  order,
  checklistItems,
  locale,
  logoSrc,
  id = DEFAULT_SHEET_ID,
}: {
  order: IntakeOrderDetail
  /** The DISPLAY read of the catalog, so a retired item still prints under the name it was answered by. */
  checklistItems: readonly IntakeChecklistItemListItem[]
  /** The paper speaks the customer's language, and it is chosen at print time — never `getLocale()`. */
  locale: IntakePrintLocale
  /** The emblem's bytes or its URL, by the same contract as on the work order. */
  logoSrc: string
  id?: string
}): ReactElement {
  const model: IntakePrintModel = buildIntakePrintModel(order, checklistItems, locale)

  return (
    <div id={id} style={HANDOVER_STYLE.page}>
      <IntakePrintHeader
        logoSrc={logoSrc}
        title={m.intake_handover_title({}, { locale })}
        subtitle={null}
        number={model.orderNumber}
        // The handover's own moment, not the intake's — and nothing at all before it is signed.
        timestamp={
          order.handoverSignedAt === null
            ? null
            : formatIntakeReceivedAtLong(order.handoverSignedAt, locale)
        }
      />

      <div style={HANDOVER_STYLE.body}>
        <HandoverReceived model={model} order={order} />

        <HandoverWork order={order} locale={locale} />

        <section style={HANDOVER_STYLE.closing}>
          <p style={HANDOVER_STYLE.statement}>{m.intake_handover_statement({}, { locale })}</p>
          <div style={HANDOVER_STYLE.signatures}>
            {/* The person handing the vehicle over is whoever is standing there, not the order's
                serviser (decision ④) — the server records him as `handover_technician_id`. His NAME
                is not on the wire yet, so the paper prints his signature over the role alone rather
                than somebody else's name. */}
            <IntakePrintSignatureBox
              path={order.handoverTechnicianSignature}
              role={m.intake_handover_signature_technician({}, { locale })}
              name={null}
            />
            <IntakePrintSignatureBox
              path={order.handoverOwnerSignature}
              role={m.intake_handover_signature_owner({}, { locale })}
              name={order.ownerName}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
