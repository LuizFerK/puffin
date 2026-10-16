import { getCurrentWebview } from "@tauri-apps/api/webview"
import { getCurrentWindow } from "@tauri-apps/api/window"

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

let zoom = 1

function setZoom(value: number) {
  zoom = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 10) / 10
  return getCurrentWebview().setZoom(zoom)
}

export const zoomIn = () => setZoom(zoom + ZOOM_STEP)
export const zoomOut = () => setZoom(zoom - ZOOM_STEP)
export const resetZoom = () => setZoom(1)

export async function toggleFullscreen() {
  const win = getCurrentWindow()
  await win.setFullscreen(!(await win.isFullscreen()))
}
