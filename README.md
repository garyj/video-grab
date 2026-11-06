# video-grab

A Chrome extension that lists the videos a tab loads and copies their URLs for [yt-dlp](https://github.com/yt-dlp/yt-dlp). It finds the same videos as Video Downloader - MPMux 1.2, but it downloads nothing and makes no network calls of its own.

- The toolbar badge shows how many videos the current tab has loaded.
- The popup lists each video with its name, format, and size.
- **Copy URL** copies the video URL.
- **Copy yt-dlp command** copies a `yt-dlp` command that sends the same request headers the browser sent.

## Load it in Chrome

1. Install the dependencies and build:

   ```sh
   pnpm install
   pnpm build
   ```

2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder, the one that holds `manifest.json`.
4. Open a page that plays a video, then click the video-grab icon.

After you change the code, run `pnpm build` again and click the reload icon on the video-grab card in `chrome://extensions`.

## How it finds videos

The service worker in `src/background.ts` watches every network response with `chrome.webRequest`. For each response, `detectVideo()` in `src/detect.ts` applies the same rules as MPMux:

- The request came from a web page (`http` or `https` initiator), and the status is 200 to 300.
- The `Content-Type` maps to a video format. If the type is missing or generic, such as `application/octet-stream`, the file extension decides.
- The file is at least 300 KB. HLS playlists (`.m3u8`) have no minimum size.
- The host is not one of four ad and cam-site CDNs that MPMux skips.

The service worker keeps one list per tab in `chrome.storage.session`. Chrome stops an idle service worker, and session storage survives that, while in-memory variables do not. A URL that matches an earlier one up to the `?` counts as the same video. Each tab keeps at most 30 videos. The list clears when the tab loads a new page or closes.

Unlike MPMux, video-grab does not skip youtube.com and globo.com.

## The yt-dlp command can contain your cookies

Some video servers refuse requests that lack the page's `Referer` or a session cookie. So video-grab keeps the request headers the browser sent for each video. The exceptions are `Range`, `Accept`, `Accept-Encoding`, `Accept-Language`, `Content-Length`, and `Content-Type`. **Copy yt-dlp command** passes the rest to yt-dlp with `--add-header`.

The copied command can include the `Cookie` header, which logs you in to that site. Treat it like a password. Do not paste it into a chat, an issue, or a shared terminal log. The headers stay in session storage and are deleted when the tab closes or navigates. Chrome also clears session storage when it restarts.

yt-dlp warns that passing cookies as a header is deprecated. It still sends them, scoped to the video's domain. It does not send them to `localhost`.

## Permissions

| Permission | Why |
| --- | --- |
| `webRequest` | Read response headers to spot videos, and request headers to rebuild the yt-dlp command. |
| `<all_urls>` | Videos come from any site. |
| `storage` | Keep the per-tab lists in `chrome.storage.session`. |

## Tests

```sh
pnpm check   # type-check src and test
pnpm test    # run the tests with Node's built-in test runner
```

`test/fixtures/requests.json` holds real `webRequest` details. They were recorded from Chromium with this extension loaded, on a test page with ffmpeg-made videos and on a local server that refuses the video without its `Referer` and cookie.
