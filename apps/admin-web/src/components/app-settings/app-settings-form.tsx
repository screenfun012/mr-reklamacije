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
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Heading,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

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
    <div className="space-y-6">
      <div className="space-y-1">
        <Heading level="h1">{m.app_settings_title()}</Heading>
        <p className="max-w-2xl text-sm text-muted-foreground">{m.app_settings_subtitle()}</p>
      </div>

      {GROUP_ORDER.map((group) => (
        <Card key={group} className="max-w-2xl">
          <CardHeader>
            <CardTitle>{GROUP_TITLE[group]()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {APP_SETTINGS.filter((definition) => definition.group === group).map((definition) => (
              <SettingField
                key={definition.key}
                definition={definition}
                value={draft[definition.key] ?? definition.defaultValue}
                onChange={(next) => setDraft((current) => ({ ...current, [definition.key]: next }))}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <Button
        onClick={handleSave}
        disabled={changed.length === 0 || saveMutation.isPending}
        className="max-w-2xl"
      >
        {m.app_settings_save()}
      </Button>
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{text.label()}</span>
        {isDefault && (
          <span className="rounded-full bg-mr-neutral-subtle px-2 py-0.5 text-[11px] text-mr-neutral-strong dark:bg-mr-neutral-600 dark:text-mr-neutral-200">
            {m.app_settings_default_badge()}
          </span>
        )}
      </div>

      {definition.valueType === AppSettingValueType.Boolean ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{m.app_settings_toggle_on()}</SelectItem>
            <SelectItem value="false">{m.app_settings_toggle_off()}</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="max-w-md"
          inputMode={definition.format === 'email' ? 'email' : 'text'}
        />
      )}

      <p className="text-xs text-muted-foreground">{text.help()}</p>

      {!isDefault && (
        <Button variant="ghost" size="sm" onClick={() => onChange(definition.defaultValue)}>
          {m.app_settings_reset()}
        </Button>
      )}
    </div>
  )
}
