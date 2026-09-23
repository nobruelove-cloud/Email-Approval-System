/**
 * Push notifications functionality has been removed cleanly.
 * This helper returns null safely without calling Notification API or registering service worker.
 */
export async function requestNotificationPermission(_userId: string): Promise<string | null> {
  return null;
}
