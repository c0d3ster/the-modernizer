import type { ViewportName } from '@modernizer/schema'

export interface InspectionViewport {
  name: ViewportName
  width: number
  height: number
  mobile: boolean
  // Only the top of the page is captured (no second screen)
  topOnly: boolean
}

export const INSPECTION_VIEWPORTS: readonly InspectionViewport[] = [
  // The most common laptop width (1536x864 is a 1920x1080 screen at 125% scaling)
  { name: 'desktop', width: 1536, height: 864, mobile: false, topOnly: false },
  { name: 'mobile', width: 375, height: 812, mobile: true, topOnly: false },
  // A fresh load at a common small-laptop width, to catch menus and layouts that break there
  { name: 'small', width: 1366, height: 768, mobile: false, topOnly: true },
]
