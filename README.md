# video-grab

A Chrome extension that lists the videos a tab loads, so you can copy their URLs into [yt-dlp](https://github.com/yt-dlp/yt-dlp). It downloads nothing itself. It sends no analytics and makes no network calls of its own.

- The toolbar badge shows how many videos the current tab has loaded.
- The popup lists each video with its name, format, and size.
- **Copy URL** copies the video URL.
- **Copy yt-dlp command** copies a `yt-dlp` command that sends the same request headers the browser sent. Use it for sites that refuse a bare URL.

Download only videos you have the right to download.

## Install from source

video-grab is not in the Chrome Web Store. To use it, build it and load it as an unpacked extension. You need [Node.js](https://nodejs.org/) 24 and [pnpm](https://pnpm.io/).

1. Clone the repo, install the dependencies, and build:

   ```sh
   git clone https://github.com/garyj/video-grab.git
   cd video-grab
   pnpm install
   pnpm build
   ```

2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `video-grab` folder, the one that holds `manifest.json`.
4. Pin video-grab to the toolbar from the puzzle-piece menu.

To update, run `git pull` and `pnpm build`, then click the reload icon on the video-grab card in `chrome://extensions`.

## Use it

1. Open a page and play the video.
2. Click the video-grab icon.
3. Click **Copy URL**, then pass the URL to yt-dlp:

   ```sh
   yt-dlp 'https://example.com/media/clip.mp4'
   ```

4. If yt-dlp fails with `HTTP Error 403: Forbidden`, click **Copy yt-dlp command** instead and run the copied command as is.

## The yt-dlp command can contain your cookies

Some video servers refuse requests that lack the page's `Referer` or a session cookie. So video-grab keeps the request headers the browser sent for each video. The exceptions are `Range`, `Accept`, `Accept-Encoding`, `Accept-Language`, `Content-Length`, and `Content-Type`. **Copy yt-dlp command** passes the rest to yt-dlp with `--add-header`.

The copied command can include the `Cookie` header, which logs you in to that site. Treat it like a password. Do not paste it into a chat, an issue, or a shared terminal log.

The headers stay in Chrome's session storage on your computer. They are deleted when the tab closes or loads a new page, and when Chrome restarts.

yt-dlp warns that passing cookies as a header is deprecated. It still sends them, scoped to the video's domain. It does not send them to `localhost`.

## How it finds videos

The service worker in `src/background.ts` watches every network response with `chrome.webRequest`. For each response, `detectVideo()` in `src/detect.ts` checks these rules:

- The request came from a web page (`http` or `https` initiator), and the status is 200 to 300.
- The `Content-Type` maps to a video format. If the type is missing or generic, such as `application/octet-stream`, the file extension decides.
- The format is a video format, such as MP4, WebM, MKV, or an HLS playlist (`.m3u8`). The full list is `VIDEO_FORMATS` in `src/detect.ts`.
- The file is at least 300 KB. HLS playlists have no minimum size.
- The host is not one of four ad and cam-site CDNs.

The service worker keeps one list per tab in `chrome.storage.session`. Chrome stops an idle service worker, and session storage survives that, while in-memory variables do not. A URL that matches an earlier one up to the `?` counts as the same video. Each tab keeps at most 30 videos.

## What it does not find

- **YouTube.** YouTube streams video in its own format (`application/vnd.yt-ump`) from URLs with no file extension. Pass the page URL to yt-dlp instead, because yt-dlp supports YouTube directly.
- **DASH streams** (`.mpd`) and the separate segments of a stream (`.ts`, `.m4s`). For HLS, video-grab lists the playlist, which is the URL yt-dlp needs.
- **Videos under 300 KB.**

## Permissions

| Permission | Why |
| --- | --- |
| `webRequest` | Read response headers to spot videos, and request headers to rebuild the yt-dlp command. |
| `<all_urls>` | Videos come from any site. |
| `storage` | Keep the per-tab lists in `chrome.storage.session`. |

## Develop

```sh
pnpm build   # compile src/ into dist/
pnpm check   # type-check src/ and test/
pnpm test    # run the tests with Node's built-in test runner
```

Chrome runs the compiled files in `dist/`, so run `pnpm build` and reload the extension after each change.

`test/fixtures/requests.json` holds real `webRequest` details. They were recorded from Chromium with this extension loaded, on a test page with ffmpeg-made videos and on a local server that refuses the video without its `Referer` and cookie.

## Credits

The detection rules reimplement those of the Video Downloader - MPMux extension, version 1.2. video-grab is not affiliated with MPMux and contains none of its code.
