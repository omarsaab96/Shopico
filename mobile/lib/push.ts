// Web keeps the same inbox and preferences without loading native push modules.
import api from "./api";
export async function registerPush(_language: string, _requestPermission = false): Promise<string> { return "web"; }
export async function unregisterPush(): Promise<void> { await api.post("/auth/logout", {}, { timeout: 5000 }); }
export async function updateBadge(_count: number): Promise<void> {}
export function listenPush(_received: (data: any) => void, _opened: (data: any) => void, _rotated: () => void): () => void { return () => {}; }
