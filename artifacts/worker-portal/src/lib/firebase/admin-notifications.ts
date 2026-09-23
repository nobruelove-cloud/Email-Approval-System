export interface SendFCMNotificationParams {
  workerId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * FCM Push Notification feature has been removed.
 * Returns false as a safe fallback without executing any API calls.
 */
export async function sendFCMNotification(_params: SendFCMNotificationParams): Promise<boolean> {
  return false;
}
