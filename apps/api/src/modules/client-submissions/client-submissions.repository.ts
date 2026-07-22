import { ClientSubmissionStatus, type CustomerKind } from '@mr/shared'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { InternalError } from '../../core/errors/domain-errors.js'
import type { SubmissionAccessInfo } from '../../core/ports/submission-access-port.js'
import {
  attachments,
  clientSubmissions,
  customers,
  customerUsers,
} from './client-submissions.schema.js'
import type {
  ClientSubmissionDetail,
  ClientSubmissionListItem,
} from './client-submissions.validators.js'

/** Live (non-soft-deleted) attachments uploaded against this submission. */
const attachmentCountSql = sql<number>`(
  SELECT COUNT(*)::int FROM ${attachments}
  WHERE ${attachments.clientSubmissionId} = ${clientSubmissions.id}
    AND ${attachments.deletedAt} IS NULL
)`.mapWith(Number)

interface ClientSubmissionListRow {
  id: string
  customerId: string
  customerName: string
  message: string
  status: ClientSubmissionStatus
  attachmentCount: number
  createdAt: Date
}

interface ClientSubmissionDetailRow extends ClientSubmissionListRow {
  linkedEmotiveClaimId: string | null
  rejectedReason: string | null
  handledAt: Date | null
  submittedByUserId: string
}

function mapListItem(row: ClientSubmissionListRow): ClientSubmissionListItem {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    message: row.message,
    status: row.status,
    attachmentCount: row.attachmentCount,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapDetail(row: ClientSubmissionDetailRow): ClientSubmissionDetail {
  return {
    ...mapListItem(row),
    linkedEmotiveClaimId: row.linkedEmotiveClaimId,
    rejectedReason: row.rejectedReason,
    handledAt: row.handledAt === null ? null : row.handledAt.toISOString(),
    submittedByUserId: row.submittedByUserId,
  }
}

const LIST_COLUMNS = {
  id: clientSubmissions.id,
  customerId: clientSubmissions.customerId,
  customerName: customers.name,
  message: clientSubmissions.message,
  status: clientSubmissions.status,
  attachmentCount: attachmentCountSql,
  createdAt: clientSubmissions.createdAt,
} as const

/** A customer the caller resolution needs (id + display name). */
export interface LinkedCustomer {
  id: string
  name: string
}

/** Drizzle write client — `this.db` by default, or a caller-provided transaction. */
type UpdateExecutor = Pick<ApiDatabase, 'update'>

export class ClientSubmissionsRepository {
  constructor(private readonly db: ApiDatabase) {}

  /**
   * The single customer a portal user submits on behalf of (the `view_own_customer` row
   * scope). Deterministic when a user is linked to more than one firm — earliest link first,
   * then by customer id — though the norm is exactly one. Ignores soft-deleted customers;
   * returns null when the user is linked to no (live) customer.
   */
  async getPrimaryCustomerForUser(userId: string): Promise<LinkedCustomer | null> {
    const [row] = await this.db
      .select({ id: customers.id, name: customers.name })
      .from(customerUsers)
      .innerJoin(customers, eq(customerUsers.customerId, customers.id))
      .where(and(eq(customerUsers.userId, userId), isNull(customers.deletedAt)))
      .orderBy(asc(customerUsers.assignedAt), asc(customerUsers.customerId))
      .limit(1)

    return row ?? null
  }

  /**
   * Ownership + status of a submission — the slice the attachments service needs to authorize
   * submission-attachment upload/list/serve. Implements `SubmissionAccessPort` structurally.
   */
  async findSubmissionAccess(submissionId: string): Promise<SubmissionAccessInfo | null> {
    const [row] = await this.db
      .select({
        submittedByUserId: clientSubmissions.submittedByUserId,
        status: clientSubmissions.status,
      })
      .from(clientSubmissions)
      .where(and(eq(clientSubmissions.id, submissionId), isNull(clientSubmissions.deletedAt)))
      .limit(1)

    return row ?? null
  }

  /** The `kind` of a customer (drives kind-aware conversion), or null if not found. */
  async getCustomerKind(customerId: string): Promise<CustomerKind | null> {
    const [row] = await this.db
      .select({ kind: customers.kind })
      .from(customers)
      .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
      .limit(1)

    return row?.kind ?? null
  }

  async create(input: {
    customerId: string
    submittedByUserId: string
    message: string
  }): Promise<{ id: string }> {
    const [created] = await this.db
      .insert(clientSubmissions)
      .values({
        customerId: input.customerId,
        submittedByUserId: input.submittedByUserId,
        message: input.message,
      })
      .returning({ id: clientSubmissions.id })

    if (created === undefined) {
      throw new InternalError('Failed to create client submission')
    }

    return created
  }

  async listPending(params: {
    page: number
    pageSize: number
  }): Promise<{ items: ClientSubmissionListItem[]; total: number }> {
    const where = and(
      eq(clientSubmissions.status, ClientSubmissionStatus.Pending),
      isNull(clientSubmissions.deletedAt),
    )
    const offset = (params.page - 1) * params.pageSize

    // Count + page run concurrently — same predicate, half the latency.
    const [countRows, rows] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)::int`.mapWith(Number) })
        .from(clientSubmissions)
        .where(where),
      this.db
        .select(LIST_COLUMNS)
        .from(clientSubmissions)
        .innerJoin(customers, eq(clientSubmissions.customerId, customers.id))
        .where(where)
        .orderBy(desc(clientSubmissions.createdAt))
        .limit(params.pageSize)
        .offset(offset),
    ])

    return {
      items: rows.map(mapListItem),
      total: countRows[0]?.total ?? 0,
    }
  }

  async findById(id: string): Promise<ClientSubmissionDetail | null> {
    const [row] = await this.db
      .select({
        ...LIST_COLUMNS,
        linkedEmotiveClaimId: clientSubmissions.linkedEmotiveClaimId,
        rejectedReason: clientSubmissions.rejectedReason,
        handledAt: clientSubmissions.handledAt,
        submittedByUserId: clientSubmissions.submittedByUserId,
      })
      .from(clientSubmissions)
      .innerJoin(customers, eq(clientSubmissions.customerId, customers.id))
      .where(and(eq(clientSubmissions.id, id), isNull(clientSubmissions.deletedAt)))
      .limit(1)

    return row === undefined ? null : mapDetail(row)
  }

  /**
   * Flips a submission pending → converted. The `status = pending` predicate makes this
   * a compare-and-swap: a concurrent convert (double-click / retry) that already flipped
   * the row matches 0 rows, so the caller can reject the loser instead of creating a
   * duplicate claim + overwriting the link. Returns the affected-row count.
   */
  async markConverted(
    id: string,
    linkedEmotiveClaimId: string,
    handledByUserId: string,
    executor: UpdateExecutor = this.db,
  ): Promise<number> {
    const rows = await executor
      .update(clientSubmissions)
      .set({
        status: ClientSubmissionStatus.Converted,
        linkedEmotiveClaimId,
        handledByUserId,
        handledAt: new Date(),
      })
      .where(
        and(
          eq(clientSubmissions.id, id),
          eq(clientSubmissions.status, ClientSubmissionStatus.Pending),
          isNull(clientSubmissions.deletedAt),
        ),
      )
      .returning({ id: clientSubmissions.id })
    return rows.length
  }

  async markRejected(
    id: string,
    reason: string | null,
    handledByUserId: string,
    executor: UpdateExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(clientSubmissions)
      .set({
        status: ClientSubmissionStatus.Rejected,
        rejectedReason: reason,
        handledByUserId,
        handledAt: new Date(),
      })
      .where(and(eq(clientSubmissions.id, id), isNull(clientSubmissions.deletedAt)))
  }

  /**
   * Soft-deletes every live attachment uploaded against this submission so a storage GC sweep
   * can reclaim the bytes. Rejected/abandoned submissions never re-point their files to a claim
   * (convert() does that), so on reject they would otherwise live in object storage forever.
   * Sets `deleted_at` only — the rows and storage bytes stay until the GC sweep runs.
   */
  async softDeleteAttachmentsForSubmission(
    submissionId: string,
    executor: UpdateExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(attachments)
      .set({ deletedAt: new Date() })
      .where(and(eq(attachments.clientSubmissionId, submissionId), isNull(attachments.deletedAt)))
  }
}
