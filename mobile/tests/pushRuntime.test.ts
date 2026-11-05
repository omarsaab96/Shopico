import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  ownership: 'standalone', available: true,
  handler: vi.fn(), badge: vi.fn(), receipt: vi.fn(), response: vi.fn(), rotation: vi.fn(),
  remove: vi.fn(), post: vi.fn(), token: vi.fn(),
}));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => mocks.available ? {} : null }));
vi.mock('expo-constants', () => ({ default: {
  get appOwnership() { return mocks.ownership; },
  expoConfig: { extra: { eas: { projectId: 'project' } } },
} }));
vi.mock('expo-device', () => ({ isDevice: true }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => key === 'notificationPushToken' ? null : 'session-token',
  setItemAsync: vi.fn(), deleteItemAsync: vi.fn(),
}));
vi.mock('../lib/api', () => ({ default: { post: mocks.post }, isSessionEnding: () => false }));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: mocks.handler, setBadgeCountAsync: mocks.badge,
  addNotificationReceivedListener: mocks.receipt,
  addNotificationResponseReceivedListener: mocks.response,
  addPushTokenListener: mocks.rotation,
  getLastNotificationResponseAsync: async () => null,
  clearLastNotificationResponseAsync: vi.fn(),
  AndroidImportance: { HIGH: 4 }, setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: async () => ({ granted: true }), getExpoPushTokenAsync: mocks.token,
}));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.available = true; mocks.ownership = 'standalone';
  mocks.receipt.mockReturnValue({ remove: mocks.remove });
  mocks.response.mockReturnValue({ remove: mocks.remove });
  mocks.rotation.mockReturnValue({ remove: mocks.remove });
  mocks.token.mockResolvedValue({ data: 'ExpoPushToken[test]' });
  mocks.post.mockResolvedValue({});
});
test('missing native push module never initializes notifications or crashes the inbox', async () => {
  mocks.available = false;
  const push = await import('../lib/push.native');
  expect(await push.registerPush('en', true)).toBe('build-required');
  await push.updateBadge(3);
  const stop = push.listenPush(vi.fn(), vi.fn(), vi.fn()); stop();
  await push.unregisterPush();
  expect(mocks.handler).not.toHaveBeenCalled();
  expect(mocks.badge).not.toHaveBeenCalled();
  expect(mocks.post).toHaveBeenCalledWith('/auth/logout', expect.anything(), expect.anything());
});
test('Expo Go skips native push initialization before attempting token registration', async () => {
  mocks.ownership = 'expo';
  const push = await import('../lib/push.native');
  expect(await push.registerPush('en', true)).toBe('build-required');
  expect(mocks.handler).not.toHaveBeenCalled();
  expect(mocks.token).not.toHaveBeenCalled();
});
test('supported installed build still registers a token and initializes the handler once', async () => {
  const push = await import('../lib/push.native');
  expect(mocks.handler).not.toHaveBeenCalled();
  expect(await push.registerPush('en')).toBe('registered');
  await push.updateBadge(2);
  expect(mocks.handler).toHaveBeenCalledOnce();
  expect(mocks.badge).toHaveBeenCalledWith(2);
  expect(mocks.post).toHaveBeenCalledWith('/notifications/devices', expect.objectContaining({ token: 'ExpoPushToken[test]' }));
});
test('unmounting while native push loads does not leave event listeners behind', async () => {
  const push = await import('../lib/push.native');
  const stop = push.listenPush(vi.fn(), vi.fn(), vi.fn()); stop();
  await push.updateBadge(0);
  expect(mocks.receipt).not.toHaveBeenCalled();
  expect(mocks.response).not.toHaveBeenCalled();
});
