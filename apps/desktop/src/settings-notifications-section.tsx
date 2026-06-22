import type { DesktopNotificationPermissionStatus } from "./ipc";
import type { NotificationPreferences } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";

interface SettingsNotificationsSectionProps {
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly platform: NodeJS.Platform;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
}

export function SettingsNotificationsSection({
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  onSetNotificationPreferences,
  platform,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
}: SettingsNotificationsSectionProps) {
  const isMac = platform === "darwin";
  const statusLabel = labelForPermissionStatus(notificationPermissionStatus);
  const statusDescription = descriptionForPermissionStatus(notificationPermissionStatus, isMac);
  const showAskMacOs = isMac && notificationPermissionStatus === "default";
  const showOpenSystemSettings = isMac && notificationPermissionStatus === "denied";
  const showRecoveryActions = showAskMacOs || showOpenSystemSettings;

  return (
    <>
      <SettingsGroup title="System" description={isMac ? "macOS decides whether pi-gui can show desktop notifications at all." : "Desktop notification availability is reported by Electron on this platform."}>
        <SettingsRow title={isMac ? "macOS notification access" : "Desktop notification support"} description={statusDescription}>
          <span className="settings-row__value">{statusLabel}</span>
        </SettingsRow>
        {showRecoveryActions ? (
          <SettingsRow
            title="Turn on notifications"
            description={
              showAskMacOs
                ? "pi-gui asks macOS when active work first moves into the background. You can also ask now."
                : "macOS notifications are already turned off for pi-gui. Open System Settings to enable them again."
            }
          >
            <div className="settings-row__actions">
              {showAskMacOs ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onRequestNotificationPermission}
                >
                  Ask macOS
                </button>
              ) : null}
              {showOpenSystemSettings ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onOpenSystemNotificationSettings}
                >
                  Open System Settings
                </button>
              ) : null}
            </div>
          </SettingsRow>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="In-app alerts" description={isMac ? "Choose which background events should try to notify once macOS access is enabled." : "Choose which background events should try to notify when desktop notifications are supported."}>
        <SettingsRow title="Background completion" description="Notify when a background session finishes.">
          <input
            aria-label="Background completion"
            checked={notificationPreferences.backgroundCompletion}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ backgroundCompletion: event.target.checked })}
          />
        </SettingsRow>
        <SettingsRow title="Background failures" description="Notify when a background session fails.">
          <input
            aria-label="Background failures"
            checked={notificationPreferences.backgroundFailure}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ backgroundFailure: event.target.checked })}
          />
        </SettingsRow>
        <SettingsRow title="Needs input or approval" description="Notify when input is needed to continue.">
          <input
            aria-label="Needs input or approval"
            checked={notificationPreferences.attentionNeeded}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ attentionNeeded: event.target.checked })}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function labelForPermissionStatus(status: DesktopNotificationPermissionStatus): string {
  switch (status) {
    case "granted":
      return "Enabled";
    case "denied":
      return "Turned off";
    case "default":
      return "Not enabled yet";
    case "unsupported":
      return "Unavailable";
    default:
      return "Checking…";
  }
}

function descriptionForPermissionStatus(status: DesktopNotificationPermissionStatus, isMac: boolean): string {
  if (!isMac) {
    return status === "unsupported"
      ? "Desktop notifications are unavailable on this system."
      : "pi-gui will use the platform notification support exposed by Electron.";
  }
  switch (status) {
    case "granted":
      return "macOS will allow pi-gui to show desktop notifications for background thread updates.";
    case "denied":
      return "macOS notifications are turned off for pi-gui. Enable them in System Settings to receive background completion alerts.";
    case "default":
      return "pi-gui has not asked macOS for desktop notification access yet.";
    case "unsupported":
      return "Desktop notifications are unavailable on this system.";
    default:
      return "Checking whether macOS notifications are available for pi-gui.";
  }
}
