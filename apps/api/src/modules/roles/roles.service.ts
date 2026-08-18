import type { Auth } from '@mr/auth'
import { clearPermissionCache, revokeUserSessions } from '@mr/auth'
import type {
  Permission,
  RoleCreateInput,
  RoleDetail,
  RoleListItem,
  RoleUpdateInput,
} from '@mr/shared'
import { AuditAction, SYSTEM_ROLE_CODES } from '@mr/shared'

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { RolesRepository } from './roles.repository.js'

/** Serbian letters have no place in a column that other code compares against. */
const TRANSLITERATION: Readonly<Record<string, string>> = {
  č: 'c',
  ć: 'c',
  ž: 'z',
  š: 's',
  đ: 'dj',
}

export function roleCodeFrom(name: string): string {
  const base = [...name.toLowerCase()]
    .map((character) => TRANSLITERATION[character] ?? character)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

  return base === '' ? 'ovlascenje' : base
}

export class RolesService {
  constructor(
    private readonly repo: RolesRepository,
    private readonly audit: AuditPort,
    private readonly auth: Auth,
  ) {}

  async list(): Promise<RoleListItem[]> {
    return this.repo.list()
  }

  async findById(id: string): Promise<RoleDetail> {
    const role = await this.repo.findById(id)
    if (role === null) {
      throw new NotFoundError('Role', id)
    }
    return role
  }

  async create(
    input: RoleCreateInput,
    actor: HttpActorContext,
    actorPermissions: readonly Permission[],
  ): Promise<RoleDetail> {
    this.assertActorHolds(input.permissions, actorPermissions)

    const code = await this.freeCodeFor(input.nameEn)
    const { id } = await this.repo.create(code, input, actor.actorUserId)
    const created = await this.findById(id)

    await this.audit.log({
      entityType: 'role',
      entityId: id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    // A brand-new set is held by nobody, so no session has to end — but the resolver caches by the
    // SORTED set of role codes, and the cache is keyed on codes it has already seen. Clearing is
    // cheap and keeps one rule instead of two.
    clearPermissionCache()

    return created
  }

  async update(
    id: string,
    input: RoleUpdateInput,
    actor: HttpActorContext,
    actorPermissions: readonly Permission[],
  ): Promise<RoleDetail> {
    const before = await this.findById(id)
    this.assertEditable(before)

    if (input.permissions !== undefined) {
      // Only what is BEING ADDED needs to be held: taking an action away is never an escalation,
      // and demanding it would leave a set nobody can shrink once its author lost the action.
      const added = input.permissions.filter(
        (permission) => !before.permissions.includes(permission),
      )
      this.assertActorHolds(added, actorPermissions)
    }

    await this.repo.update(id, input, actor.actorUserId)
    const after = await this.findById(id)

    await this.audit.log({
      entityType: 'role',
      entityId: id,
      action: AuditAction.PermissionChange,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before, after },
    })

    await this.applyImmediately(id)

    return after
  }

  async duplicate(
    id: string,
    names: { nameSr: string; nameEn: string },
    actor: HttpActorContext,
    actorPermissions: readonly Permission[],
  ): Promise<RoleDetail> {
    const source = await this.findById(id)

    return this.create(
      {
        nameSr: names.nameSr,
        nameEn: names.nameEn,
        description: source.description,
        permissions: source.permissions,
      },
      actor,
      actorPermissions,
    )
  }

  async softDelete(id: string, actor: HttpActorContext): Promise<void> {
    const before = await this.findById(id)
    this.assertEditable(before)

    if (before.userCount > 0) {
      throw new ConflictError(
        `Ovlašćenje drži ${String(before.userCount)} osoba i ne može se obrisati.`,
      )
    }

    await this.repo.softDelete(id, actor.actorUserId)

    await this.audit.log({
      entityType: 'role',
      entityId: id,
      action: AuditAction.Delete,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before },
    })

    // Nobody holds it, so no session ends — but a cached entry keyed on its code would keep
    // answering with its actions until the TTL ran out.
    clearPermissionCache()
  }

  /**
   * "You cannot hand out what you do not hold" — the rule from Kubernetes RBAC. Without it anyone
   * allowed to build a set could write themselves one containing every action and climb the ladder
   * in a single request. Nobody meets it today (only the super-admin assigns anything) and it is
   * still built now: it is ten lines here and impossible to retrofit once sets exist in the wild.
   */
  private assertActorHolds(
    requested: readonly Permission[],
    actorPermissions: readonly Permission[],
  ): void {
    const missing = requested.filter((permission) => !actorPermissions.includes(permission))

    if (missing.length > 0) {
      throw new ForbiddenError(`Ne možeš dati radnju koju sam nemaš: ${missing.join(', ')}`)
    }
  }

  private assertEditable(role: RoleDetail): void {
    if (role.isSystem || SYSTEM_ROLE_CODES.includes(role.code as never)) {
      throw new UnprocessableEntityError(
        'Ugrađeno ovlašćenje se ne menja — umnoži ga pa menjaj kopiju.',
      )
    }
  }

  /**
   * A change to what a set allows has to reach the people holding it NOW. The resolver caches for
   * five minutes and a session lives for days, so without both of these somebody keeps an action
   * that was taken away from them — which is the whole difference between a permission system and
   * a suggestion.
   */
  private async applyImmediately(roleId: string): Promise<void> {
    clearPermissionCache()

    const holders = await this.repo.findHolderIds(roleId)
    for (const userId of holders) {
      await revokeUserSessions(this.auth, userId)
    }
  }

  private async freeCodeFor(name: string): Promise<string> {
    const base = roleCodeFrom(name)

    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}_${String(suffix + 1)}`
      if ((await this.repo.findByCode(candidate)) === null) {
        return candidate
      }
    }

    throw new ConflictError('Ne mogu da napravim jedinstvenu šifru za ovo ime.')
  }
}
