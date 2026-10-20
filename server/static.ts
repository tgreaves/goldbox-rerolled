// The built app (web/dist) as static files, with the security headers every response carries.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import type { Config } from './config.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
}

/**
 * The app's needs: its own scripts and styles (inline style attributes, hence 'unsafe-inline' for
 * styles only), WebGL, canvases turned into data: URLs (window borders), blob: downloads, fonts
 * built in memory, the service worker and its manifest; nothing from other origins.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(res: ServerResponse, config: Config) {
  res.setHeader('Content-Security-Policy', CSP)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000')
}

export async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string, root: string): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' }).end('method not allowed')
    return
  }
  let rel: string
  try { rel = decodeURIComponent(pathname) } catch { rel = '\0' }
  if (rel.endsWith('/')) rel += 'index.html'
  const clean = normalize(rel).replace(/^[\\/]+/, '')
  // no NUL, no parent steps, no hidden files
  if (rel.includes('\0') || clean.split(/[\\/]/).some((s) => s === '..' || s.startsWith('.'))) return notFound(res)
  const file = join(root, clean)
  if (file !== root && !file.startsWith(root + sep)) return notFound(res)
  let st
  try { st = await stat(file) } catch { return notFound(res, root) }
  if (!st.isFile()) return notFound(res)
  const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
  // hashed bundles never change; everything else (index.html, sw.js, the manifest) is revalidated
  res.setHeader('Cache-Control', clean.startsWith(`assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.setHeader('ETag', etag)
  if (req.headers['if-none-match'] === etag) { res.writeHead(304).end(); return }
  res.setHeader('Content-Length', st.size)
  res.writeHead(200)
  if (req.method === 'HEAD') { res.end(); return }
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}

async function notFound(res: ServerResponse, root?: string) {
  if (root && !(await stat(join(root, 'index.html')).then(() => true, () => false))) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('The app is not built: run npm run build in web/.')
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }).end('not found')
}
