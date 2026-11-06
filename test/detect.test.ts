import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { ytDlpCommand } from "../src/command.ts";
import { detectVideo } from "../src/detect.ts";
import recorded from "./fixtures/requests.json" with { type: "json" };

// Recorded from Chromium with the extension loaded. See README "Tests".
interface Recorded {
  response: chrome.webRequest.OnResponseStartedDetails;
  requestHeaders: chrome.webRequest.HttpHeader[];
}
const requests = recorded as unknown as Record<keyof typeof recorded, Recorded>;

function detect(name: keyof typeof recorded) {
  const { response, requestHeaders } = requests[name];
  return detectVideo(response, requestHeaders);
}

test("finds an MP4 over 300 KB and reads its full size from Content-Range", () => {
  const video = detect("largeMp4");
  assert.equal(requests.largeMp4.response.statusCode, 206);
  assert.equal(video?.format, "mp4");
  assert.equal(video?.filename, "big-test.mp4");
  assert.equal(video?.size, 1132089);
});

test("finds an HLS playlist served as application/octet-stream", () => {
  const video = detect("hlsPlaylist");
  assert.equal(video?.format, "m3u8");
  assert.equal(video?.size, 0);
});

test("skips an MP4 under 300 KB and an HLS segment", () => {
  assert.equal(detect("smallMp4"), null);
  assert.equal(detect("hlsSegment"), null);
});

test("skips videos from blocked CDNs", () => {
  const { response, requestHeaders } = requests.largeMp4;
  const fromBlockedCdn = { ...response, url: "https://media.doppiocdn.com/big-test.mp4" };
  assert.equal(detectVideo(fromBlockedCdn, requestHeaders), null);
});

test("keeps the Cookie and Referer a protected video needs, and drops Range", () => {
  const headers = detect("protectedMp4")?.headers ?? {};
  assert.equal(headers.Cookie, "vg_session=let-me-in");
  assert.match(headers.Referer, /^http:\/\/lvh\.me:8765\/$/);
  assert.equal(headers.Range, undefined);
});

test("yt-dlp command survives shell quoting", () => {
  const video = detect("protectedMp4")!;
  const tricky = { ...video, url: "https://example.com/it's a video.mp4", headers: { Cookie: `a='1'; b="2"` } };
  const echoArgs = ytDlpCommand(tricky).replace(/^yt-dlp/, "printf '%s\\n'");
  const args = execFileSync("sh", ["-c", echoArgs], { encoding: "utf8" }).trimEnd().split("\n");
  assert.deepEqual(args, ["--add-header", `Cookie:a='1'; b="2"`, "https://example.com/it's a video.mp4"]);
});
