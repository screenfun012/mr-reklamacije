import { m } from '@mr/i18n'
import {
  APP_SETTINGS,
  AppSettingGroup,
  AppSettingKey,
  AppSettingValueType,
  appSettingsOptions,
  patchAppSettings,
  type AppSettingDefinition,
  type AppSettingValues,
} from '@mr/shared'
import { cn, toast } from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { admFieldClassName, admPrimaryButtonClassName } from '~/lib/adm-chrome'

/**
 * The registry carries no text on purpose — every user-facing string in this repository comes from
 * Paraglide. TypeScript demands an entry here for each key, so a new setting cannot reach the screen
 * unlabelled.
 */
const SETTING_TEXT: Record<AppSettingKey, { label: () => string; help: () => string }> = {
  [AppSettingKey.NotifyClientOnOutcome]: {
    label: () => m.app_settings_notify_client_label(),
    help: () => m.app_settings_notify_client_help(),
  },
  [AppSettingKey.ClientSubmissionsNotifyEmail]: {
    label: () => m.app_settings_submission_email_label(),
    help: () => m.app_settings_submission_email_help(),
  },
  [AppSettingKey.SupportPhone]: {
    label: () => m.app_settings_support_phone_label(),
    help: () => m.app_settings_support_phone_help(),
  },
  [AppSettingKey.SupportEmail]: {
    label: () => m.app_settings_support_email_label(),
    help: () => m.app_settings_support_email_help(),
  },
}

const GROUP_TITLE: Record<AppSettingGroup, () => string> = {
  [AppSettingGroup.Notifications]: () => m.app_settings_group_notifications(),
  [AppSettingGroup.Support]: () => m.app_settings_group_support(),
}

const GROUP_ORDER: readonly AppSettingGroup[] = [
  AppSettingGroup.Notifications,
  AppSettingGroup.Support,
]

/** What the server would resolve today: the override if there is one, the code default otherwise. */
function effectiveValue(definition: AppSettingDefinition, values: AppSettingValues): string {
  return values[definition.key] ?? definition.defaultValue
}

function buildDraft(values: AppSettingValues): Record<string, string> {
  return Object.fromEntries(
    APP_SETTINGS.map((definition) => [definition.key, effectiveValue(definition, values)]),
  )
}

export function AppSettingsForm(): React.ReactElement {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(appSettingsOptions())
  const [draft, setDraft] = useState<Record<string, string>>(() => buildDraft(data.values))

  const saveMutation = useMutation({
    mutationFn: (values: AppSettingValues) => patchAppSettings(values),
    onSuccess: (result) => {
      queryClient.setQueryData(appSettingsOptions().queryKey, result)
      // The server decides what an override IS — saving a value that equals the default stores
      // nothing — so the form follows its answer rather than what was typed.
      setDraft(buildDraft(result.values))
      toast.success(m.app_settings_saved())
    },
    onError: () => {
      toast.error(m.app_settings_save_error())
    },
  })

  const changed = APP_SETTINGS.filter(
    (definition) => draft[definition.key] !== effectiveValue(definition, data.values),
  )

  const handleSave = (): void => {
    const values: AppSettingValues = Object.fromEntries(
      changed.map((definition) => [definition.key, draft[definition.key] ?? null]),
    )
    saveMutation.mutate(values)
  }

  return (
    <div className="adm-enter flex max-w-[760px] flex-col gap-4">
      <div>
        <h1 className="text-balance text-2xl font-extrabold tracking-[-0.02em] text-foreground">
          {m.app_settings_title()}
        </h1>
        <p className="mt-[5px] text-[13px] text-muted-foreground">{m.app_settings_subtitle()}</p>
      </div>

      {GROUP_ORDER.map((group) => (
        <section
          key={group}
          className="overflow-hidden rounded-[14px] border border-border bg-card"
        >
          <h2 className="border-b border-border px-5 py-3.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-adm-red-h">
            {GROUP_TITLE[group]()}
          </h2>
          {APP_SETTINGS.filter((definition) => definition.group === group).map((definition) => (
            <SettingField
              key={definition.key}
              definition={definition}
              value={draft[definition.key] ?? definition.defaultValue}
              onChange={(next) => setDraft((current) => ({ ...current, [definition.key]: next }))}
            />
          ))}
        </section>
      ))}

      <div className="flex items-center justify-end gap-3.5">
        {/* The button is dead until something changed, so it has to say what it is waiting for —
            and, once there is something, exactly how much of it leaves this screen. */}
        <span className="text-[12.5px] text-muted-foreground">
          {changed.length === 0
            ? m.app_settings_no_changes()
            : m.app_settings_changed_count({ count: changed.length })}
        </span>
        <button
          type="button"
          className={`${admPrimaryButtonClassName} flex-none px-7 shadow-[0_8px_22px_rgba(0,0,0,.3)]`}
          disabled={changed.length === 0 || saveMutation.isPending}
          onClick={handleSave}
        >
          {m.app_settings_save()}
        </button>
      </div>
    </div>
  )
}

function SettingField({
  definition,
  value,
  onChange,
}: {
  definition: AppSettingDefinition
  value: string
  onChange: (next: string) => void
}): React.ReactElement {
  const text = SETTING_TEXT[definition.key]
  const isDefault = value === definition.defaultValue

  const isBoolean = definition.valueType === AppSettingValueType.Boolean

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border px-5 py-4 last:border-b-0">
      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13.5px] font-bold text-foreground">{text.label()}</span>
          {isDefault && (
            <span className="rounded-md bg-adm-inbg px-[7px] py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {m.app_settings_default_badge()}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">{text.help()}</p>
        {isDefault ? null : (
          <button
            type="button"
            className="mt-1 cursor-pointer text-[11.5px] font-bold text-adm-red-h"
            onClick={() => onChange(definition.defaultValue)}
          >
            {m.app_settings_reset()}
          </button>
        )}
      </div>

      {isBoolean ? (
        <div
          className="flex flex-none overflow-hidden rounded-[9px] border border-mr-border-strong"
          role="group"
          aria-label={text.label()}
        >
          {[
            { value: 'true', label: m.app_settings_toggle_on(), on: 'bg-adm-grn/15 text-adm-grn' },
            {
              value: 'false',
              label: m.app_settings_toggle_off(),
              on: 'bg-mr-brand/[0.13] text-adm-red-h',
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              className={cn(
                'cursor-pointer px-[18px] py-2.5 text-[12px] font-extrabold transition-colors',
                value === option.value
                  ? option.on
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <input
          className={`${admFieldClassName} max-w-[320px] flex-none font-mono text-[13px]`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={definition.format === 'email' ? 'email' : 'text'}
          aria-label={text.label()}
        />
      )}
    </div>
  )
}
