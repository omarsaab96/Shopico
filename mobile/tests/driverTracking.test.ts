import { beforeEach, afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: { currentState: "active" }, listeners: new Set<(state: string) => void>(),
  callbacks: [] as ((position: any) => void)[], removals: [] as ReturnType<typeof vi.fn>[],
  permission: vi.fn(), watch: vi.fn(), token: vi.fn(), put: vi.fn(),
}));
vi.mock("react-native", () => ({ AppState: {
  get currentState() { return mocks.state.currentState; },
  addEventListener: (_event: string, listener: (state: string) => void) => {
    mocks.listeners.add(listener); return { remove: () => mocks.listeners.delete(listener) };
  },
} }));
vi.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: mocks.permission,
  getForegroundPermissionsAsync: mocks.permission,
  watchPositionAsync: mocks.watch,
}));
vi.mock("expo-secure-store", () => ({ getItemAsync: mocks.token }));
vi.mock("axios", () => ({ default: { put: mocks.put } }));
import { pushDriverLocationOnce, startDriverTracking, stopDriverTracking } from "../lib/driverTracking";

const coords = { latitude: 33.5, longitude: 36.3 };
const changeState = async (state: string) => {
  mocks.state.currentState = state;
  mocks.listeners.forEach(listener => listener(state));
  await vi.waitFor(() => { if (state === "active") expect(mocks.watch).toHaveBeenCalled(); });
};
beforeEach(async () => {
  await stopDriverTracking();
  vi.clearAllMocks(); mocks.callbacks.length = 0; mocks.removals.length = 0;
  mocks.state.currentState = "active";
  mocks.permission.mockResolvedValue({ status: "granted" });
  mocks.token.mockResolvedValue("access-token"); mocks.put.mockResolvedValue({});
  mocks.watch.mockImplementation(async (_options, callback) => {
    mocks.callbacks.push(callback);
    const remove = vi.fn(); mocks.removals.push(remove); return { remove };
  });
});
afterEach(() => stopDriverTracking());

test("foreground permission and watcher share driver coordinates", async () => {
  await startDriverTracking("order-a");
  mocks.callbacks[0]({ coords });
  await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledWith(expect.stringContaining('/orders/order-a/driver-location'),
    { lat: 33.5, lng: 36.3 }, expect.anything()));
});
test("backgrounding removes watcher and drops late callbacks and direct pushes", async () => {
  await startDriverTracking("order-a");
  await changeState("background");
  expect(mocks.removals[0]).toHaveBeenCalledOnce();
  mocks.callbacks[0]({ coords });
  await pushDriverLocationOnce("order-a", coords);
  expect(mocks.put).not.toHaveBeenCalled();
});
test("returning to app resumes watcher without a new permission prompt", async () => {
  await startDriverTracking("order-a");
  await changeState("inactive");
  await changeState("active");
  await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(2));
  mocks.callbacks[0]({ coords });
  expect(mocks.put).not.toHaveBeenCalled();
  mocks.callbacks[1]({ coords });
  await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledOnce());
});
test("sign-out or completed delivery stops updates and prevents resume", async () => {
  await startDriverTracking("order-a");
  await stopDriverTracking("order-a");
  expect(mocks.listeners.size).toBe(0);
  mocks.callbacks[0]({ coords });
  expect(mocks.put).not.toHaveBeenCalled();
});
test("stopping an old order cannot stop a different current delivery", async () => {
  await startDriverTracking("order-a");
  await startDriverTracking("order-b");
  await stopDriverTracking("order-a");
  mocks.callbacks.at(-1)!({ coords });
  await vi.waitFor(() => expect(mocks.put).toHaveBeenCalledWith(expect.stringContaining('/orders/order-b/'), expect.anything(), expect.anything()));
});
test("permission denial never starts a watcher", async () => {
  mocks.permission.mockResolvedValue({ status: "denied" });
  await expect(startDriverTracking("order-a")).rejects.toThrow("permission denied");
  expect(mocks.watch).not.toHaveBeenCalled();
});
test("a pending watcher cannot reactivate tracking after sign-out", async () => {
  let resolve!: (value: any) => void;
  const remove = vi.fn();
  mocks.watch.mockReturnValueOnce(new Promise(value => { resolve = value; }));
  const starting = startDriverTracking("order-a");
  await vi.waitFor(() => expect(mocks.watch).toHaveBeenCalledOnce());
  await stopDriverTracking();
  resolve({ remove }); await starting;
  expect(remove).toHaveBeenCalledOnce();
});
test("authorization failure stops the delivery watcher", async () => {
  await startDriverTracking("order-a");
  mocks.put.mockRejectedValue({ response: { status: 403 } });
  await expect(pushDriverLocationOnce("order-a", coords)).rejects.toMatchObject({ response: { status: 403 } });
  expect(mocks.removals[0]).toHaveBeenCalledOnce();
  expect(mocks.listeners.size).toBe(0);
});

test("sign-out drops a location waiting for credentials", async () => {
  await startDriverTracking("order-a");
  let resolve!: (token: string) => void;
  mocks.token.mockReturnValueOnce(new Promise(value => { resolve = value; }));
  const pending = pushDriverLocationOnce("order-a", coords);
  await stopDriverTracking();
  resolve("old-token"); await pending;
  expect(mocks.put).not.toHaveBeenCalled();
});
