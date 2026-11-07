const IMAGE_RE = /\.(png|jpe?g)(\?|$)/i;

/** Image fetch abort. Distinct from public-API FEED_MS (8s) and Gemini chat (55s). */
export const DECODE_QR_MS = 2_500;
export const QR_IMAGE_ACCEPT = "image/png,image/jpeg";

/** Payload encoded in a QR *image URL* (chart APIs), not guessed from title text. */
export function payloadFromQrImageUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const fromQuery =
      u.searchParams.get("data") ||
      u.searchParams.get("text") ||
      u.searchParams.get("chl");
    if (fromQuery && fromQuery.trim()) return fromQuery.trim().slice(0, 500);
    return null;
  } catch {
    return null;
  }
}

export function isQrImageUrl(url: string): boolean {
  if (payloadFromQrImageUrl(url)) return true;
  try {
    const path = new URL(url).pathname;
    return IMAGE_RE.test(path);
  } catch {
    return false;
  }
}

type Rgba = { data: Uint8ClampedArray; width: number; height: number };

async function rgbaFromBytes(bytes: Uint8Array, contentType: string, url: string): Promise<Rgba | null> {
  const kind = contentType.includes("jpeg") || contentType.includes("jpg") || /\.jpe?g(\?|$)/i.test(url)
    ? "jpeg"
    : contentType.includes("png") || /\.png(\?|$)/i.test(url)
      ? "png"
      : null;
  if (!kind) return null;
  if (kind === "png") {
    const { PNG } = await import("pngjs");
    const png = PNG.sync.read(Buffer.from(bytes));
    return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
  }
  const jpeg = await import("jpeg-js");
  const img = jpeg.decode(Buffer.from(bytes), { maxMemoryUsageInMB: 8 });
  return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
}

/** Decode a QR from an image URL. Times out. Never invents a payload. */
export async function decodeQrFromImageUrl(url: string): Promise<string | null> {
  const fromUrl = payloadFromQrImageUrl(url);
  if (fromUrl) return fromUrl;
  if (!isQrImageUrl(url)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DECODE_QR_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: QR_IMAGE_ACCEPT },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 32 || buf.byteLength > 1_500_000) return null;
    const rgba = await rgbaFromBytes(buf, type, url);
    if (!rgba) return null;
    const jsQR = (await import("jsqr")).default;
    const code = jsQR(rgba.data, rgba.width, rgba.height);
    return code?.data?.trim().slice(0, 500) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
