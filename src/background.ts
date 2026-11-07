import { detectVideo, type Video } from "./detect.ts";
import { clearVideos, getVideos, setVideos } from "./storage.ts";

const MAX_VIDEOS_PER_TAB = 30;

const filter: chrome.webRequest.RequestFilter = {
  urls: ["<all_urls>"],
  types: ["media", "xmlhttprequest", "object", "other"],
};

/** Request headers by request ID, held until the response arrives or the request fails. */
const sentHeaders = new Map<string, chrome.webRequest.HttpHeader[]>();

// Cookie and Referer are only visible with "extraHeaders".
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    sentHeaders.set(details.requestId, details.requestHeaders ?? []);
  },
  filter,
  ["requestHeaders", "extraHeaders"],
);

chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    const requestHeaders = sentHeaders.get(details.requestId);
    sentHeaders.delete(details.requestId);
    const video = detectVideo(details, requestHeaders);
    if (video) enqueue(() => addVideo(details.tabId, details.initiator!, video));
  },
  filter,
  ["responseHeaders"],
);

chrome.webRequest.onErrorOccurred.addListener((details) => {
  sentHeaders.delete(details.requestId);
}, filter);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && changeInfo.url) {
    enqueue(async () => {
      await clearVideos(tabId);
      await chrome.action.setBadgeText({ tabId, text: "" });
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => clearVideos(tabId));
});

// Storage updates read, change, then write the list. Two at once would lose a video.
let queue = Promise.resolve();
function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch((error) => console.error("video-grab:", error));
}

async function addVideo(tabId: number, initiator: string, video: Video): Promise<void> {
  // Requests from a page's service worker have no tab.
  if (tabId === -1) tabId = await findTabByOrigin(initiator);
  if (tabId === -1) return;

  const videos = await getVideos(tabId);
  if (videos.length >= MAX_VIDEOS_PER_TAB) return;

  if (!videos.some((found) => withoutQuery(found.url) === withoutQuery(video.url))) {
    videos.push(video);
    await setVideos(tabId, videos);
  }
  await chrome.action.setBadgeText({ tabId, text: String(videos.length) });
}

async function findTabByOrigin(origin: string): Promise<number> {
  const tabs = await chrome.tabs.query({});
  const matches = tabs.filter((tab) => tab.url?.startsWith(origin));
  const tab = matches.find((match) => match.active) ?? matches.at(-1);
  return tab?.id ?? -1;
}

function withoutQuery(url: string): string {
  return url.split("?")[0];
}
