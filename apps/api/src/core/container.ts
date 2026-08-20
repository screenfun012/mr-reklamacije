import {
  createAuth,
  createLoginAttemptStore,
  createPermissionResolver,
  type LoginAttemptStore,
} from '@mr/auth'
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
import { PdfRenderer } from './pdf/pdf-renderer.js'
import { AuditLogRepository, AuditLogService, AuditService } from '../modules/audit/index.js'
import { NotificationsRepository, NotificationsService } from '../modules/notifications/index.js'
import { IntakeOrdersRepository, IntakeOrdersService } from '../modules/intake-orders/index.js'
import { ClaimPresenceStore, PresenceService } from '../modules/presence/index.js'
import { AppSettingsRepository, AppSettingsService } from '../modules/app-settings/index.js'
import { ClaimSourcesRepository, ClaimSourcesService } from '../modules/claim-sources/index.js'
import { RolesRepository, RolesService } from '../modules/roles/index.js'
import { CustomersRepository, CustomersService } from '../modules/customers/index.js'
import { UsersRepository, UsersService } from '../modules/users/index.js'
import { RegistrationService } from '../modules/registration/index.js'
import { ActivationRepository, ActivationService } from '../modules/activation/index.js'
import type { EmailPort } from './ports/email-port.js'
import { createEmailPort } from '../infrastructure/email/email-adapter.js'
import { FaultsRepository } from './claims/faults.repository.js'
import { MrRegistryRepository, MrRegistryService } from './mr-registry/index.js'
import { DepartmentsRepository, DepartmentsService } from '../modules/departments/index.js'
import {
  IntakeChecklistItemsRepository,
  IntakeChecklistItemsService,
} from '../modules/intake-checklist-items/index.js'
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
import {
  ClaimCategoriesRepository,
  ClaimCategoriesService,
} from '../modules/claim-categories/index.js'
import { EmotiveClaimsRepository, EmotiveClaimsService } from '../modules/emotive-claims/index.js'
import {
  ClientSubmissionsRepository,
  ClientSubmissionsService,
} from '../modules/client-submissions/index.js'
import {
  ExternalPartiesRepository,
  ExternalPartiesService,
} from '../modules/external-parties/index.js'
import {
  AttachmentsRepository,
  AttachmentsService,
  SubmissionAttachmentsService,
} from '../modules/attachments/index.js'
import { ReportImageReadAdapter } from '../modules/attachments/report-image-read.adapter.js'
import { ClaimReportsRepository, ClaimReportsService } from '../modules/claim-reports/index.js'
import { ExcelRepository, ExcelService } from '../modules/excel/index.js'
import { InProcessEventBus, PostgresEventBus } from '../modules/events/index.js'
import { createBetterAuthUserPassword } from '../infrastructure/auth/better-auth-user-password.js'
import { createBetterAuthUserSessions } from '../infrastructure/auth/better-auth-user-sessions.js'
import { createStorageService } from '../infrastructure/storage/create-storage-service.js'
import type { StorageService } from '../infrastructure/storage/storage.interface.js'
import { createRedisClient } from '../infrastructure/cache/redis-client.js'
import { RedisCache } from '../infrastructure/cache/redis-cache.js'
import { createRedisLoginAttemptStore } from '../infrastructure/cache/redis-login-attempt-store.js'
import { resolveCacheKeyPrefix } from '../infrastructure/cache/cache-key-prefix.js'
import { createRateLimiters, type RateLimiters } from './middleware/rate-limit.js'
import { SummaryCache } from '../infrastructure/cache/summary-cache.js'
import { CacheInvalidatingEventBus } from '../infrastructure/cache/cache-invalidating-event-bus.js'
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
  /** Best-effort server-side cache (Redis when REDIS_URL is set, otherwise a disabled no-op). */
  cache: RedisCache
  /** Rate-limit middlewares, Redis-backed when the cache is enabled (shared across replicas). */
  rateLimiters: RateLimiters
  auth: ReturnType<typeof createAuth>
  permissionResolver: ReturnType<typeof createPermissionResolver>
  auditService: AuditPort
  auditLogRepository: AuditLogRepository
  auditLogService: AuditLogService
  notificationsRepository: NotificationsRepository
  notificationsService: NotificationsService
  intakeOrdersRepository: IntakeOrdersRepository
  intakeOrdersService: IntakeOrdersService
  presenceService: PresenceService
  employeesRepository: EmployeesRepository
  employeesService: EmployeesService
  engineTypesRepository: EngineTypesRepository
  engineTypesService: EngineTypesService
  engineManufacturersRepository: EngineManufacturersRepository
  engineManufacturersService: EngineManufacturersService
  claimCategoriesRepository: ClaimCategoriesRepository
  claimCategoriesService: ClaimCategoriesService
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
  appSettingsRepository: AppSettingsRepository
  appSettingsService: AppSettingsService
  rolesRepository: RolesRepository
  rolesService: RolesService
  claimSourcesRepository: ClaimSourcesRepository
  claimSourcesService: ClaimSourcesService
  departmentsRepository: DepartmentsRepository
  departmentsService: DepartmentsService
  intakeChecklistItemsRepository: IntakeChecklistItemsRepository
  intakeChecklistItemsService: IntakeChecklistItemsService
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
  submissionAttachmentsService: SubmissionAttachmentsService
  claimReportsRepository: ClaimReportsRepository
  pdfRenderer: PdfRenderer
  claimReportsService: ClaimReportsService
  excelRepository: ExcelRepository
  excelService: ExcelService
  storageService: StorageService
}

export function createContainer(env: Env, logger: Logger): Container {
  const { db, pool } = createDb(env)
  const postgresEventBus = new PostgresEventBus(pool, env.DATABASE_URL, logger)
  void postgresEventBus.start()
  // One Redis client + env prefix shared by the cache and the login-lockout store.
  const redis = createRedisClient(env, logger)
  const keyPrefix = resolveCacheKeyPrefix(env)
  const cache = new RedisCache(redis, logger, keyPrefix)
  // Wrap the transport so every claim mutation invalidates the statistics/dashboard cache.
  const eventBus = new CacheInvalidatingEventBus(postgresEventBus, new SummaryCache(cache))
  // Shared login-lockout across replicas when Redis is on; in-memory (buildContainer default) otherwise.
  const loginAttemptStore =
    redis === null ? undefined : createRedisLoginAttemptStore(redis, keyPrefix, logger)
  return buildContainer(
    env,
    logger,
    db,
    pool,
    eventBus,
    cache,
    createEmailPort(env),
    loginAttemptStore,
  )
}

export function buildContainer(
  env: Env,
  logger: Logger,
  db: NodePgDatabase<typeof schema>,
  pool: Pool,
  eventBus: EventBus = new InProcessEventBus(),
  cache: RedisCache = new RedisCache(null),
  emailPort: EmailPort = createEmailPort(env),
  loginAttemptStore?: LoginAttemptStore,
): Container {
  const rateLimiters = createRateLimiters(cache)
  const auth = createAuth(db, {
    trustedOrigins: env.PUBLIC_ORIGINS,
    onUserRegistered: () => {
      eventBus.publishResourceChanged(ResourceChangedKey.Users)
    },
    // In-memory by default (tests, single instance); Redis-backed store when supplied.
    loginAttemptStore: loginAttemptStore ?? createLoginAttemptStore(),
  })
  const permissionResolver = createPermissionResolver(db)
  const auditService = new AuditService(db)
  const auditLogRepository = new AuditLogRepository(db)
  const auditLogService = new AuditLogService(auditLogRepository)

  const notificationsRepository = new NotificationsRepository(db)
  const notificationsService = new NotificationsService(notificationsRepository, eventBus, logger)
  // In-memory, single-replica presence (see presence.store.ts + docs/22 §4).
  const presenceService = new PresenceService(new ClaimPresenceStore())

  const employeesRepository = new EmployeesRepository(db)
  const employeesService = new EmployeesService(employeesRepository, auditService, eventBus)

  const engineTypesRepository = new EngineTypesRepository(db)
  const engineTypesService = new EngineTypesService(
    engineTypesRepository,
    auditService,
    eventBus,
    notificationsService,
  )

  const engineManufacturersRepository = new EngineManufacturersRepository(db)
  const engineManufacturersService = new EngineManufacturersService(
    engineManufacturersRepository,
    auditService,
    eventBus,
    notificationsService,
  )

  const claimCategoriesRepository = new ClaimCategoriesRepository(db)
  const claimCategoriesService = new ClaimCategoriesService(
    claimCategoriesRepository,
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
  const customersService = new CustomersService(
    customersRepository,
    auditService,
    eventBus,
    notificationsService,
  )

  const usersRepository = new UsersRepository(db)
  const userSessions = createBetterAuthUserSessions(auth)
  const userPassword = createBetterAuthUserPassword(auth)

  const activationRepository = new ActivationRepository(db)
  const portalBaseUrl = env.CLIENT_SIGNUP_ORIGINS[0] ?? 'http://localhost:3003'
  // One reader for every consumer: the settings it resolves are global, and two instances would
  // only mean two identical queries.
  const appSettingsReader = new DbAppSettingsReader(db)

  const activationService = new ActivationService(
    activationRepository,
    emailPort,
    auth,
    portalBaseUrl,
    appSettingsReader,
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

  const appSettingsRepository = new AppSettingsRepository(db)
  const appSettingsService = new AppSettingsService(appSettingsRepository, auditService)

  const rolesRepository = new RolesRepository(db)
  const rolesService = new RolesService(rolesRepository, auditService, auth)

  const claimSourcesRepository = new ClaimSourcesRepository(db)
  const claimSourcesService = new ClaimSourcesService(
    claimSourcesRepository,
    auditService,
    eventBus,
  )

  const departmentsRepository = new DepartmentsRepository(db)
  const departmentsService = new DepartmentsService(departmentsRepository, auditService, eventBus)

  const intakeChecklistItemsRepository = new IntakeChecklistItemsRepository(db)
  const intakeChecklistItemsService = new IntakeChecklistItemsService(
    intakeChecklistItemsRepository,
    auditService,
    eventBus,
  )

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
    emailPort,
    appSettingsReader,
    portalBaseUrl,
    logger,
    notificationsService,
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
    appSettingsReader,
    logger,
    internalBaseUrl,
    notificationsService,
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
    notificationsService,
  )

  const claimsRepository = new ClaimsRepository(db)
  const claimsService = new ClaimsService(claimsRepository)

  // Read-through cache for the two heavy summary reads; invalidated via the wrapped event bus.
  const summaryCache = new SummaryCache(cache)

  const dashboardRepository = new DashboardRepository(db)
  const dashboardService = new DashboardService(
    dashboardRepository,
    summaryCache,
    appSettingsReader,
  )

  const statisticsRepository = new StatisticsRepository(db)
  const statisticsService = new StatisticsService(statisticsRepository, summaryCache)

  const storageService = createStorageService(env)

  // Built after the storage service because intake photos go through it (docs/25 V-4).
  const intakeOrdersRepository = new IntakeOrdersRepository(db)
  // Declared before its first consumer: the intake document and the claim report share ONE browser.
  const pdfRenderer = new PdfRenderer()

  const intakeOrdersService = new IntakeOrdersService(
    intakeOrdersRepository,
    auditService,
    eventBus,
    storageService,
    // The catalog is what decides which checklist codes an order may store (spec ⑭), and it names
    // the rows the sealed document prints.
    intakeChecklistItemsRepository,
    // The same browser the claim report uses — one instance, two slots, released when idle.
    pdfRenderer,
    // The sealed sheet goes to the owner as an attachment; disabled email simply skips the send.
    emailPort,
    appSettingsReader,
    logger,
  )
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
  )
  const submissionAttachmentsService = new SubmissionAttachmentsService(
    attachmentsRepository,
    storageService,
    auditService,
    eventBus,
    clientSubmissionsRepository,
  )

  const claimReportsRepository = new ClaimReportsRepository(db)
  const claimReportsService = new ClaimReportsService(
    claimReportsRepository,
    claimContextService,
    reportImageRead,
    auditService,
    pdfRenderer,
    env.CLAIM_REPORT_PDF_ENABLED,
  )

  const excelRepository = new ExcelRepository(db)
  const excelService = new ExcelService(excelRepository, auditService)

  return {
    env,
    logger,
    db,
    pool,
    cache,
    rateLimiters,
    auth,
    permissionResolver,
    auditService,
    auditLogRepository,
    auditLogService,
    notificationsRepository,
    notificationsService,
    intakeOrdersRepository,
    intakeOrdersService,
    presenceService,
    employeesRepository,
    employeesService,
    engineTypesRepository,
    engineTypesService,
    engineManufacturersRepository,
    engineManufacturersService,
    claimCategoriesRepository,
    claimCategoriesService,
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
    appSettingsRepository,
    appSettingsService,
    rolesRepository,
    rolesService,
    claimSourcesService,
    departmentsRepository,
    departmentsService,
    intakeChecklistItemsRepository,
    intakeChecklistItemsService,
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
    submissionAttachmentsService,
    claimReportsRepository,
    pdfRenderer,
    claimReportsService,
    excelRepository,
    excelService,
    storageService,
  }
}
