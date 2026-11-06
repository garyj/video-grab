import { ytDlpCommand } from "./command.ts";
import type { Video } from "./detect.ts";
import { getVideos } from "./storage.ts";

const list = document.querySelector<HTMLUListElement>("#videos")!;
const empty = document.querySelector<HTMLParagraphElement>("#empty")!;

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const tabId = tab.id!;

await render();
chrome.storage.session.onChanged.addListener((changes) => {
  if (String(tabId) in changes) render();
});

async function render(): Promise<void> {
  const videos = await getVideos(tabId);
  empty.hidden = videos.length > 0;
  list.replaceChildren(...videos.map(videoItem));
}

function videoItem(video: Video): HTMLLIElement {
  const item = document.createElement("li");

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = video.filename;
  name.title = video.url;

  const details = document.createElement("div");
  details.className = "details";
  details.textContent = `${video.format.toUpperCase()} · ${formatSize(video.size)}`;

  item.append(
    name,
    details,
    copyButton("Copy URL", video.url),
    copyButton("Copy yt-dlp command", ytDlpCommand(video)),
  );
  return item;
}

function copyButton(label: string, text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = label), 1500);
  });
  return button;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "stream";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
