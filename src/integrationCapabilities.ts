import type { DidaIntegrationSettings, LocalAppleIntegrationSettings } from "./types";

export function canCreateAppleRemindersCapability(
  localApple: Pick<LocalAppleIntegrationSettings, "enabled" | "remindersCreateEnabled">,
  isLocalAppleSupported: boolean
): boolean {
  return isLocalAppleSupported && localApple.enabled && localApple.remindersCreateEnabled;
}

export function canCreateDidaTasksCapability(
  dida: Pick<DidaIntegrationSettings, "enabled" | "tasksCreateEnabled" | "apiToken">
): boolean {
  return dida.enabled && dida.tasksCreateEnabled && Boolean(dida.apiToken.trim());
}

export function canDeleteAppleReminderCapability(
  localApple: Pick<LocalAppleIntegrationSettings, "enabled" | "remindersEnabled">,
  isLocalAppleSupported: boolean,
  externalId?: string
): boolean {
  return isLocalAppleSupported && localApple.enabled && localApple.remindersEnabled && Boolean(externalId);
}

export function canDeleteAppleCalendarEventCapability(
  localApple: Pick<LocalAppleIntegrationSettings, "enabled" | "calendarEnabled">,
  isLocalAppleSupported: boolean,
  isWritable: boolean,
  eventId?: string
): boolean {
  return isLocalAppleSupported && localApple.enabled && localApple.calendarEnabled && isWritable && Boolean(eventId);
}
