import type { Video } from "./detect.ts";

/** Builds a yt-dlp command that sends the same headers the browser sent. */
export function ytDlpCommand(video: Video): string {
  const parts = ["yt-dlp"];
  for (const [name, value] of Object.entries(video.headers)) {
    parts.push("--add-header", shellQuote(`${name}:${value}`));
  }
  parts.push(shellQuote(video.url));
  return parts.join(" ");
}

function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}
