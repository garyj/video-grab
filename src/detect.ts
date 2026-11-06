// Detection rules match MPMux 1.2's background.js.

export interface Video {
  url: string;
  filename: string;
  format: string;
  /** Size in bytes. Always 0 for HLS playlists, which have no size limit. */
  size: number;
  /** Request headers the browser sent, so yt-dlp can repeat them. */
  headers: Record<string, string>;
}

type ResponseDetails = chrome.webRequest.OnResponseStartedDetails;
type HttpHeader = chrome.webRequest.HttpHeader;

const MIN_SIZE = 300 * 1024;

const VIDEO_FORMATS = ["m3u8", "m3u", "mp4", "3gp", "flv", "mov", "avi", "wmv", "webm", "f4v", "acc", "mkv"];
const HLS_FORMATS = ["m3u8", "m3u"];

/** Formats each known content type can have. The first one is the default. */
const FORMATS_BY_CONTENT_TYPE: Record<string, string[]> = {
  "application/vnd.apple.mpegurl": ["m3u8", "m3u"],
  "application/x-mpegurl": ["m3u8", "m3u"],
  "application/vnd.americandynamics.acc": ["acc"],
  "application/vnd.rn-realmedia-vbr": ["rmvb"],
  "video/mp4": ["mp4", "m4s"],
  "video/3gpp": ["3gp"],
  "video/3gpp2": ["3gp2"],
  "video/x-flv": ["flv"],
  "video/quicktime": ["mov"],
  "video/x-msvideo": ["avi"],
  "video/x-ms-wmv": ["wmv"],
  "video/webm": ["webm"],
  "video/ogg": ["ogg", "ogv"],
  "video/x-f4v": ["f4v"],
  "video/x-matroska": ["mkv"],
  "video/iso.segment": ["m4s"],
};

/** File extensions trusted when the content type is unknown or generic. */
const VIDEO_EXTENSIONS = ["m3u8", "m3u", "mp4", "webm", "avi", "ogg", "flv", "mkv", "3gp"];

/** Ad and cam-site CDNs, matched on the domain name without its TLD. */
const BLOCKED_CDNS = ["doppiocdn", "adtng", "afcdn", "sacdnssedge"];

/** Range would make yt-dlp fetch only the chunk the player asked for. */
const SKIPPED_REQUEST_HEADERS = ["range", "accept-encoding", "accept", "accept-language", "content-length", "content-type"];

/** Returns the video this response carries, or null if it is not a video. */
export function detectVideo(response: ResponseDetails, requestHeaders: HttpHeader[] = []): Video | null {
  const { url, initiator, statusCode } = response;
  const responseHeaders = response.responseHeaders ?? [];

  if (!initiator?.startsWith("http")) return null;
  if (responseHeaders.length === 0) return null;
  if (statusCode < 200 || statusCode > 300) return null;
  if (isBlockedCdn(url)) return null;

  const contentType = findHeader(responseHeaders, "content-type")?.toLowerCase() ?? guessContentType(response);
  if (!contentType) return null;

  const filename = filenameOf(url, responseHeaders);
  const format = formatOf(filename, contentType);
  if (!format || !VIDEO_FORMATS.includes(format)) return null;

  const size = HLS_FORMATS.includes(format) ? 0 : sizeOf(responseHeaders);
  if (!HLS_FORMATS.includes(format) && size < MIN_SIZE) return null;

  return { url, filename, format, size, headers: replayableHeaders(requestHeaders) };
}

function findHeader(headers: HttpHeader[], name: string): string | undefined {
  return headers.find((header) => header.name.toLowerCase() === name)?.value;
}

function guessContentType({ url, type }: ResponseDetails): string | null {
  const path = new URL(url).pathname.toLowerCase();
  if (type === "media" && path.endsWith(".mp4")) return "video/mp4";
  if (type === "media" && path.endsWith(".webm")) return "video/webm";
  if (type === "xmlhttprequest" && path.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  return null;
}

function isBlockedCdn(url: string): boolean {
  const labels = new URL(url).hostname.split(".");
  labels.pop();
  return BLOCKED_CDNS.includes(labels.at(-1) ?? "");
}

function filenameOf(url: string, headers: HttpHeader[]): string {
  const disposition = findHeader(headers, "content-disposition") ?? "";
  const part = disposition.split(";").find((p) => p.includes("filename="));
  const fromDisposition = part?.replace(/filename=/i, "").replace(/["']/g, "").trim();
  return fromDisposition || new URL(url).pathname.split("/").pop() || "unnamed-file";
}

function formatOf(filename: string, contentType: string): string | null {
  const extension = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : null;
  const formats = FORMATS_BY_CONTENT_TYPE[contentType];
  if (formats) return extension && formats.includes(extension) ? extension : formats[0];
  return extension && VIDEO_EXTENSIONS.includes(extension) ? extension : null;
}

/** A 206 partial response carries the full size after the slash in Content-Range. */
function sizeOf(headers: HttpHeader[]): number {
  const total = Number(findHeader(headers, "content-range")?.split("/")[1]);
  if (total > 0) return total;
  return Number(findHeader(headers, "content-length")) || 0;
}

function replayableHeaders(headers: HttpHeader[]): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const { name, value } of headers) {
    if (value !== undefined && !SKIPPED_REQUEST_HEADERS.includes(name.toLowerCase())) kept[name] = value;
  }
  return kept;
}
