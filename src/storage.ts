import type { Video } from "./detect.ts";

export async function getVideos(tabId: number): Promise<Video[]> {
  const key = String(tabId);
  const stored = await chrome.storage.session.get<Record<string, Video[]>>(key);
  return stored[key] ?? [];
}

export async function setVideos(tabId: number, videos: Video[]): Promise<void> {
  await chrome.storage.session.set({ [String(tabId)]: videos });
}

export async function clearVideos(tabId: number): Promise<void> {
  await chrome.storage.session.remove(String(tabId));
}
