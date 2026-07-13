import { createAuth, createPermissionResolver } from '@mr/auth'
import { schema } from '@mr/db'
import { ResourceChangedKey, resolveProtectedSuperAdminEmail } from '@mr/shared'
import type { Logger } from '@mr/logger'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import type { Env } from '../config/env.js'
import { createDb } from '../infrastructure/db.js'
import type { AuditPort } from './ports/audit-port.js'
import type { EventBus } from './ports/event-bus-port.js'
import { ClaimContextService } from './claims/claim-context.service.js'
import { AuditLogRepository, AuditLogService, AuditService } from '../modules/audit/index.js'
import { ClaimSourcesRepository, ClaimSourcesService } from '../modules/claim-sources/index.js'
import { CustomersRepository, CustomersService } from '../modules/customers/index.js'
import { UsersRepository, UsersService } from '../modules/users/index.js'
import { RegistrationService } from '../modules/registration/index.js'
import { ActivationRepository, ActivationService } from '../modules/activation/index.js'
import type { EmailPort } from './ports/email-port.js'
import { createEmailPort } from '../infrastructure/email/email-adapter.js'
import { FaultsRepository } from './claims/faults.repository.js'
import { MrRegistryRepository, MrRegistryService } from './mr-registry/index.js'
import { DepartmentsRepository, DepartmentsService } from '../modules/departments/index.js'
import { DomaceClaimsRepository, DomaceClaimsService } from '../modules/domace-claims/index.js'
import { ClaimsRepository, ClaimsService } from '../modules/claims/index.js'
import { DashboardRepository, DashboardService } from '../modules/dashboard/index.js'
import { StatisticsRepository, StatisticsService } from '../modules/statistics/index.js'
import { EmployeesRepository, EmployeesService } from '../modules/employees/index.js'
import { EngineTypesRepository, EngineTypesService } from '../modules/engine-types/index.js'
import {
  EngineManufacturersRepository,
  EngineManufacturersService,
} from '../modules/engine-manufacturers/index.js'
import { EmotiveClaimsRepository, EmotiveClaimsService } from '../modules/emotive-claims/index.js'
import {
  ClientSubmissionsRepository,
  ClientSubmissionsService,
} from '../modules/client-submissions/index.js'
import {
  ExternalPartiesRepository,
  ExternalPartiesService,
} from '../modules/external-parties/index.js'
import { AttachmentsRepository, AttachmentsService } from '../modules/attachments/index.js'
import { ReportImageReadAdapter } from '../modules/attachments/report-image-read.adapter.js'
import {
  ClaimReportPdfRenderer,
  ClaimReportsRepository,
  ClaimReportsService,
} from '../modules/claim-reports/index.js'
import { ExcelRepository, ExcelService } from '../modules/excel/index.js'
import { InProcessEventBus } from '../modules/events/index.js'
import { createBetterAuthUserPassword } from '../infrastructure/auth/better-auth-user-password.js'
import { createBetterAuthUserSessions } from '../infrastructure/auth/better-auth-user-sessions.js'
import { createStorageService } from '../infrastructure/storage/create-storage-service.js'
import type { StorageService } from '../infrastructure/storage/storage.interface.js'
import { DbAppSettingsReader } from './settings/app-settings.reader.js'

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
  auditLogRepository: AuditLogRepository
  auditLogService: AuditLogService
  employeesRepository: EmployeesRepository
  employeesService: EmployeesService
  engineTypesRepository: EngineTypesRepository
  engineTypesService: EngineTypesService
  engineManufacturersRepository: EngineManufacturersRepository
  engineManufacturersService: EngineManufacturersService
  externalPartiesRepository: ExternalPartiesRepository
  externalPartiesService: ExternalPartiesService
  customersRepository: CustomersRepository
  customersService: CustomersService
  usersRepository: UsersRepository
  usersService: UsersService
  registrationService: RegistrationService
  emailPort: EmailPort
  activationRepository: ActivationRepository
  activationService: ActivationService
  claimSourcesRepository: ClaimSourcesRepository
  claimSourcesService: ClaimSourcesService
  departmentsRepository: DepartmentsRepository
  departmentsService: DepartmentsService
  eventBus: EventBus
  emotiveClaimsRepository: EmotiveClaimsRepository
  emotiveClaimsService: EmotiveClaimsService
  clientSubmissionsRepository: ClientSubmissionsRepository
  clientSubmissionsService: ClientSubmissionsService
  domaceClaimsRepository: DomaceClaimsRepository
  domaceClaimsService: DomaceClaimsService
  claimsRepository: ClaimsRepository
  claimsService: ClaimsService
  dashboardRepository: DashboardRepository
  dashboardService: DashboardService
  statisticsRepository: StatisticsRepository
  statisticsService: StatisticsService
  mrRegistryService: MrRegistryService
  attachmentsRepository: AttachmentsRepository
  attachmentsService: AttachmentsService
  claimReportsRepository: ClaimReportsRepository
  claimReportPdfRenderer: ClaimReportPdfRenderer
  claimReportsService: ClaimReportsService
  excelRepository: ExcelRepository
  excelService: ExcelService
  storageService: StorageService
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
  eventBus: EventBus = new InProcessEventBus(),
  emailPort: EmailPort = createEmailPort(env),
): Container {
  const auth = createAuth(db, {
    trustedOrigins: env.PUBLIC_ORIGINS,
    onUserRegistered: () => {
      eventBus.publishResourceChanged(ResourceChangedKey.Users)
    },
  })
  const permissionResolver = createPermissionResolver(db)
  const auditService = new AuditService(db)
  const auditLogRepository = new AuditLogRepository(db)
  const auditLogService = new AuditLogService(auditLogRepository)

  const employeesRepository = new EmployeesRepository(db)
  const employeesService = new EmployeesService(employeesRepository, auditService, eventBus)

  const engineTypesRepository = new EngineTypesRepository(db)
  const engineTypesService = new EngineTypesService(engineTypesRepository, auditService, eventBus)

  const engineManufacturersRepository = new EngineManufacturersRepository(db)
  const engineManufacturersService = new EngineManufacturersService(
    engineManufacturersRepository,
    auditService,
    eventBus,
  )

  const externalPartiesRepository = new ExternalPartiesRepository(db)
  const externalPartiesService = new ExternalPartiesService(
    externalPartiesRepository,
    auditService,
    eventBus,
  )

  const customersRepository = new CustomersRepository(db)
  const customersService = new CustomersService(customersRepository, auditService, eventBus)

  const usersRepository = new UsersRepository(db)
  const userSessions = createBetterAuthUserSessions(auth)
  const userPassword = createBetterAuthUserPassword(auth)

  const activationRepository = new ActivationRepository(db)
  const portalBaseUrl = env.CLIENT_SIGNUP_ORIGINS[0] ?? 'http://localhost:3003'
  const activationService = new ActivationService(
    activationRepository,
    emailPort,
    auth,
    portalBaseUrl,
    logger,
  )

  const usersService = new UsersService(
    usersRepository,
    auditService,
    eventBus,
    resolveProtectedSuperAdminEmail(env.PROTECTED_SUPER_ADMIN_EMAIL),
    userSessions,
    userPassword,
    activationService,
  )

  const registrationService = new RegistrationService(db, auth)

  const claimSourcesRepository = new ClaimSourcesRepository(db)
  const claimSourcesService = new ClaimSourcesService(
    claimSourcesRepository,
    auditService,
    eventBus,
  )

  const departmentsRepository = new DepartmentsRepository(db)
  const departmentsService = new DepartmentsService(departmentsRepository, auditService, eventBus)

  const emotiveFaultsRepository = new FaultsRepository(schema.emotiveClaimFaults)
  const mrRegistryRepository = new MrRegistryRepository(db)
  const mrRegistryService = new MrRegistryService(mrRegistryRepository)
  const emotiveClaimsRepository = new EmotiveClaimsRepository(
    db,
    emotiveFaultsRepository,
    mrRegistryService,
  )
  const emotiveClaimsService = new EmotiveClaimsService(
    emotiveClaimsRepository,
    auditService,
    eventBus,
  )

  const clientSubmissionsRepository = new ClientSubmissionsRepository(db)
  // Internal-web origin for the "/pristiglo" link in notification emails (mirrors portalBaseUrl).
  const internalBaseUrl = env.SELF_SIGNUP_ORIGINS[0] ?? 'http://localhost:3002'
  const clientSubmissionsService = new ClientSubmissionsService(
    db,
    clientSubmissionsRepository,
    emotiveClaimsService,
    emailPort,
    eventBus,
    auditService,
    new DbAppSettingsReader(db),
    logger,
    internalBaseUrl,
  )

  const domaceFaultsRepository = new FaultsRepository(schema.domaceClaimFaults)
  const domaceClaimsRepository = new DomaceClaimsRepository(
    db,
    domaceFaultsRepository,
    mrRegistryService,
  )
  const domaceClaimsService = new DomaceClaimsService(
    domaceClaimsRepository,
    auditService,
    eventBus,
  )

  const claimsRepository = new ClaimsRepository(db)
  const claimsService = new ClaimsService(claimsRepository)

  const dashboardRepository = new DashboardRepository(db)
  const dashboardService = new DashboardService(dashboardRepository)

  const statisticsRepository = new StatisticsRepository(db)
  const statisticsService = new StatisticsService(statisticsRepository)

  const storageService = createStorageService(env)
  const attachmentsRepository = new AttachmentsRepository(db)
  const claimContextService = new ClaimContextService(
    emotiveClaimsRepository,
    domaceClaimsRepository,
  )
  const reportImageRead = new ReportImageReadAdapter(attachmentsRepository, storageService)
  const attachmentsService = new AttachmentsService(
    attachmentsRepository,
    storageService,
    claimContextService,
    auditService,
    eventBus,
    env.ATTACHMENT_SIGNING_SECRET ?? env.BETTER_AUTH_SECRET,
    env.API_BASE_URL,
    clientSubmissionsRepository,
  )

  const claimReportsRepository = new ClaimReportsRepository(db)
  const claimReportPdfRenderer = new ClaimReportPdfRenderer()
  const claimReportsService = new ClaimReportsService(
    claimReportsRepository,
    claimContextService,
    reportImageRead,
    auditService,
    claimReportPdfRenderer,
    env.CLAIM_REPORT_PDF_ENABLED,
  )

  const excelRepository = new ExcelRepository(db)
  const excelService = new ExcelService(excelRepository, auditService)

  return {
    env,
    logger,
    db,
    pool,
    auth,
    permissionResolver,
    auditService,
    auditLogRepository,
    auditLogService,
    employeesRepository,
    employeesService,
    engineTypesRepository,
    engineTypesService,
    engineManufacturersRepository,
    engineManufacturersService,
    externalPartiesRepository,
    externalPartiesService,
    customersRepository,
    customersService,
    usersRepository,
    usersService,
    registrationService,
    emailPort,
    activationRepository,
    activationService,
    claimSourcesRepository,
    claimSourcesService,
    departmentsRepository,
    departmentsService,
    eventBus,
    emotiveClaimsRepository,
    emotiveClaimsService,
    clientSubmissionsRepository,
    clientSubmissionsService,
    domaceClaimsRepository,
    domaceClaimsService,
    claimsRepository,
    claimsService,
    dashboardRepository,
    dashboardService,
    statisticsRepository,
    statisticsService,
    mrRegistryService,
    attachmentsRepository,
    attachmentsService,
    claimReportsRepository,
    claimReportPdfRenderer,
    claimReportsService,
    excelRepository,
    excelService,
    storageService,
  }
}
