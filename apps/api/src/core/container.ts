import { createAuth, createPermissionResolver } from '@mr/auth'
import { schema } from '@mr/db'
import type { Logger } from '@mr/logger'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import type { Env } from '../config/env.js'
import { createDb } from '../infrastructure/db.js'
import type { AuditPort } from './ports/audit-port.js'
import type { EventBus } from './ports/event-bus-port.js'
import { AuditService } from '../modules/audit/index.js'
import { ClaimSourcesRepository, ClaimSourcesService } from '../modules/claim-sources/index.js'
import { CustomersRepository, CustomersService } from '../modules/customers/index.js'
import { DepartmentsRepository, DepartmentsService } from '../modules/departments/index.js'
import { EmployeesRepository, EmployeesService } from '../modules/employees/index.js'
import { EngineTypesRepository, EngineTypesService } from '../modules/engine-types/index.js'
import { EmotiveClaimsRepository, EmotiveClaimsService } from '../modules/emotive-claims/index.js'
import { FaultsRepository } from '../modules/emotive-claims/faults/faults.repository.js'
import { ExternalPartiesRepository, ExternalPartiesService } from '../modules/external-parties/index.js'
import { NoOpEventBus } from '../modules/events/index.js'

/**
 * Application DI container. All stateful services are constructed here once
 * per process; route modules receive slices via `createApp(container)`.
 */
export interface Container {
  env: Env
  logger: Logger
  db: NodePgDatabase<typeof schema>
  pool: Pool
  auth: ReturnType<typeof createAuth>
  permissionResolver: ReturnType<typeof createPermissionResolver>
  auditService: AuditPort
  employeesRepository: EmployeesRepository
  employeesService: EmployeesService
  engineTypesRepository: EngineTypesRepository
  engineTypesService: EngineTypesService
  externalPartiesRepository: ExternalPartiesRepository
  externalPartiesService: ExternalPartiesService
  customersRepository: CustomersRepository
  customersService: CustomersService
  claimSourcesRepository: ClaimSourcesRepository
  claimSourcesService: ClaimSourcesService
  departmentsRepository: DepartmentsRepository
  departmentsService: DepartmentsService
  eventBus: EventBus
  emotiveClaimsRepository: EmotiveClaimsRepository
  emotiveClaimsService: EmotiveClaimsService
}

export function createContainer(env: Env, logger: Logger): Container {
  const { db, pool } = createDb(env)
  return buildContainer(env, logger, db, pool)
}

export function buildContainer(
  env: Env,
  logger: Logger,
  db: NodePgDatabase<typeof schema>,
  pool: Pool,
  eventBus: EventBus = new NoOpEventBus(),
): Container {
  const auth = createAuth(db, { trustedOrigins: env.PUBLIC_ORIGINS })
  const permissionResolver = createPermissionResolver(db)
  const auditService = new AuditService(db)

  const employeesRepository = new EmployeesRepository(db)
  const employeesService = new EmployeesService(employeesRepository)

  const engineTypesRepository = new EngineTypesRepository(db)
  const engineTypesService = new EngineTypesService(engineTypesRepository, auditService)

  const externalPartiesRepository = new ExternalPartiesRepository(db)
  const externalPartiesService = new ExternalPartiesService(
    externalPartiesRepository,
    auditService,
  )

  const customersRepository = new CustomersRepository(db)
  const customersService = new CustomersService(customersRepository)

  const claimSourcesRepository = new ClaimSourcesRepository(db)
  const claimSourcesService = new ClaimSourcesService(claimSourcesRepository)

  const departmentsRepository = new DepartmentsRepository(db)
  const departmentsService = new DepartmentsService(departmentsRepository)

  const faultsRepository = new FaultsRepository()
  const emotiveClaimsRepository = new EmotiveClaimsRepository(db, faultsRepository)
  const emotiveClaimsService = new EmotiveClaimsService(
    emotiveClaimsRepository,
    auditService,
    eventBus,
  )

  return {
    env,
    logger,
    db,
    pool,
    auth,
    permissionResolver,
    auditService,
    employeesRepository,
    employeesService,
    engineTypesRepository,
    engineTypesService,
    externalPartiesRepository,
    externalPartiesService,
    customersRepository,
    customersService,
    claimSourcesRepository,
    claimSourcesService,
    departmentsRepository,
    departmentsService,
    eventBus,
    emotiveClaimsRepository,
    emotiveClaimsService,
  }
}
