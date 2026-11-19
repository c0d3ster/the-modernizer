import type { PageCta, PageFeatures } from '@modernizer/schema'

type Vendor = readonly [name: string, pattern: RegExp]

/**
 * Runs inside the page via page.evaluate, so it must be fully self-contained: no imports at runtime
 * and no references to module scope. Everything is a heuristic; vendor names are matched on real
 * links, scripts and iframes rather than page text, because stray mentions (a CSS class named
 * "opentable-style-dark", an award "from Opencare") caused false positives on real sites.
 */
export const detectFeatures = (): PageFeatures => {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const html = document.documentElement.outerHTML
  const text = document.body?.innerText ?? ''

  const isVisible = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const inFirstScreen = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    return r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0
  }
  const classOf = (el: Element): string => el.getAttribute('class') ?? ''
  const innerTextOf = (el: Element): string => (el instanceof HTMLElement ? el.innerText : el.textContent ?? '')
  const vendorIn = (source: string, list: readonly Vendor[]): string | null =>
    list.find(([, pattern]) => pattern.test(source))?.[0] ?? null
  const allVendors = (source: string, list: readonly Vendor[]): string[] =>
    list.filter(([, pattern]) => pattern.test(source)).map(([name]) => name)

  const bigInFirstScreen = (el: Element): boolean => {
    const r = el.getBoundingClientRect()
    return isVisible(el) && inFirstScreen(el) && r.width > vw * 0.5 && r.height > vh * 0.3
  }
  const iframes = [...document.querySelectorAll('iframe')]
  const heroVideo = [...document.querySelectorAll('video')].some(bigInFirstScreen)
    || iframes.some((f) => /youtube|vimeo|wistia|vidyard/i.test(f.src) && bigInFirstScreen(f))

  const menuLinks = [...document.querySelectorAll('header a, nav a, [role=navigation] a')]
    .filter((a) => isVisible(a) && inFirstScreen(a))
    .map((a) => innerTextOf(a).trim().replace(/\s+/g, ' '))
    .filter((t) => t.length > 1 && t.length < 28)
  const menuButton = [...document.querySelectorAll('button, a, div, span')].some((el) => {
    if (!isVisible(el) || !inFirstScreen(el)) return false
    const r = el.getBoundingClientRect()
    if (r.width > 90 || r.height > 90) return false
    return /hamburger|burger|menu-toggle|nav-toggle|navbar-toggler|mobile-menu|menu-btn|menu-icon|toggle-menu|menu-trigger|nav-trigger|open-?button/i.test(`${classOf(el)} ${el.id}`)
      || /\bmenu\b|navigation/i.test(el.getAttribute('aria-label') ?? '')
      || (el.hasAttribute('aria-expanded') && r.top < 160 && innerTextOf(el).trim().length <= 4)
  })

  const telLinks = [...document.querySelectorAll('a[href^="tel:"]')]
  const telInFold = telLinks.some((a) => isVisible(a) && inFirstScreen(a))
  const phoneInText = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(text)

  const BOOKING: readonly Vendor[] = [
    ['LocalMed', /localmed/i], ['NexHealth', /nexhealth/i], ['Zocdoc', /zocdoc/i], ['Opencare', /opencare\.com\/(book|dentists)/i], ['Weave', /getweave|weave\.com/i],
    ['Flex', /flexbook|flexdental/i], ['Calendly', /calendly/i], ['Acuity', /acuityscheduling/i], ['Square', /squareup\.com\/appointments|square\.site\/book/i],
    ['Setmore', /setmore/i], ['Housecall Pro', /housecallpro/i], ['ServiceTitan', /servicetitan|scheduleengine/i], ['Jobber', /getjobber|jobber\.com/i],
    ['OpenTable', /opentable\.com/i], ['Resy', /resy\.com/i], ['Tock', /exploretock/i], ['Yelp', /yelp\.com\/reservations/i],
    ['Sesame', /sesamecommunications|mysesame/i], ['Modento', /modento/i], ['Dentrix', /dentrixascend.*(book|schedul)|onlinescheduling\.dentrix/i],
  ]
  // Some schedulers only load from inline scripts; match their function names, not loose mentions.
  const INLINE_BOOKING: readonly Vendor[] = [['ServiceTitan', /STWidgetManager|ScheduleEngine\.show/], ['Housecall Pro', /HCPWidget/]]
  const ORDERING: readonly Vendor[] = [
    ['Toast', /toasttab/i], ['ChowNow', /chownow/i], ['Slice', /slicelife/i], ['DoorDash', /doordash/i], ['Grubhub', /grubhub/i], ['Uber Eats', /ubereats/i],
    ['BentoBox', /getbento|bentobox/i], ['Olo', /olo\.com/i], ['Square Online', /square\.site|squareup\.com\/store/i], ['Clover', /clover\.com\/online-ordering/i],
    ['Shopify', /cdn\.shopify\.com/i], ['WooCommerce', /woocommerce/i], ['Ecwid', /ecwid/i],
  ]
  const STORE_PLATFORMS = new Set(['Shopify', 'WooCommerce', 'Ecwid'])
  const PAYMENTS: readonly Vendor[] = [
    ['Stripe', /js\.stripe\.com|checkout\.stripe/i], ['Square', /squareup\.com\/pay|square\.link|web\.squarecdn/i], ['PayPal', /paypal\.com\/(sdk|cgi)|paypalobjects/i],
    ['PaySimple', /paysimple/i], ['Clover', /clover\.com\/pay/i], ['CareCredit', /carecredit/i], ['Cherry', /withcherry/i], ['Sunbit', /sunbit/i],
  ]
  const ANALYTICS: readonly Vendor[] = [
    ['Google Analytics', /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/i], ['Google Tag Manager', /googletagmanager\.com\/gtm/i], ['Meta Pixel', /fbevents\.js|fbq\(/i],
    ['Microsoft Clarity', /clarity\.ms/i], ['Hotjar', /hotjar/i], ['Plausible', /plausible\.io/i], ['Matomo', /matomo/i], ['CallRail', /callrail/i],
  ]
  const CHAT: readonly Vendor[] = [
    ['Podium', /podium/i], ['Birdeye', /birdeye/i], ['Tawk', /tawk\.to/i], ['Intercom', /intercom/i], ['Drift', /drift\.com|js\.driftt/i], ['LiveChat', /livechatinc/i], ['Tidio', /tidio/i],
    ['HubSpot', /js\.usemessages|hubspot.*conversations/i], ['Zendesk', /zdassets|zendesk/i], ['Weave', /getweave/i], ['Smartsupp', /smartsupp/i], ['Olark', /olark/i],
    ['ApexChat', /apexchat/i], ['Ngage', /ngagelive/i], ['NICE CXone', /incontact/i],
  ]
  const REVIEW_WIDGETS: readonly Vendor[] = [
    ['Elfsight', /elfsight/i], ['Trustindex', /trustindex/i], ['Birdeye', /birdeye/i], ['Grade.us', /grade\.us/i], ['EmbedSocial', /embedsocial/i],
    ['Reviews on My Website', /reviewsonmywebsite/i], ['Trustpilot', /trustpilot/i],
  ]
  const SOCIAL: readonly Vendor[] = [
    ['Facebook', /facebook\.com\//i], ['Instagram', /instagram\.com\//i], ['YouTube', /youtube\.com\//i], ['TikTok', /tiktok\.com\//i],
    ['LinkedIn', /linkedin\.com\//i], ['X', /\/\/(www\.)?(twitter|x)\.com\//i], ['Yelp', /yelp\.com\/biz/i],
  ]
  const PLATFORMS: readonly Vendor[] = [
    ['WordPress', /wp-content|wp-includes/i], ['Wix', /static\.wixstatic\.com|wix-warmup/i], ['Squarespace', /static1\.squarespace|squarespace-cdn/i],
    ['GoDaddy Website Builder', /img1\.wsimg\.com/i], ['Weebly', /weebly|editmysite/i], ['Duda', /irp\.cdn-website\.com|multiscreensite/i], ['Webflow', /data-wf-site/i],
    ['Shopify', /cdn\.shopify\.com/i], ['Next.js', /_next\/static/i], ['Elementor', /elementor/i], ['Divi', /et_pb_|\/themes\/divi/i],
    ['Avada', /\/themes\/avada|fusion-builder/i], ['WPBakery', /vc_row|wpbakery/i], ['ProSites', /prosites/i], ['Officite', /officite/i],
    ['Sesame', /sesamecommunications/i], ['PBHS', /pbhs/i],
  ]

  const host = location.hostname.replace(/^www\./, '')
  const allLinks = [...document.querySelectorAll('a[href]')].flatMap((a) => (a instanceof HTMLAnchorElement ? [a.href] : []))
  const sources = [
    ...allLinks,
    ...[...document.querySelectorAll('script[src]')].flatMap((s) => (s instanceof HTMLScriptElement ? [s.src] : [])),
    ...iframes.map((f) => f.src),
  ].join(' ')
  const inlineScripts = [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent ?? '').join(' ')

  const describeHref = (raw: string): string => {
    if (!raw) return 'does nothing obvious'
    if (raw.startsWith('tel:')) return 'starts a phone call'
    if (raw.startsWith('mailto:')) return 'opens an email'
    if (raw.startsWith('javascript:') || raw === '#') return 'opens a popup or menu'
    try {
      const u = new URL(raw, location.href)
      const vendor = vendorIn(u.href, BOOKING)
      if (vendor) return `online booking (${vendor})`
      const otherHost = u.hostname.replace(/^www\./, '')
      if (otherHost !== host) return `another site (${otherHost})`
      if (u.hash && u.pathname === location.pathname) return 'jumps to a section on this page'
      return `page: ${u.pathname === '/' ? 'home' : decodeURIComponent(u.pathname).replace(/\/$/, '')}`
    } catch {
      return 'unknown'
    }
  }
  const CTA = /book|schedul|appointment|consult|quote|estimate|call|contact|reserve|order|request|get started|free|menu|visit/i
  const seenCta = new Set<string>()
  const ctas: PageCta[] = [...document.querySelectorAll('a[href], button')]
    .filter((el) => isVisible(el) && inFirstScreen(el) && CTA.test(innerTextOf(el)) && innerTextOf(el).trim().length < 40)
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { text: innerTextOf(el).trim().replace(/\s+/g, ' '), goesTo: describeHref(el.getAttribute('href') ?? ''), area: r.width * r.height }
    })
    .sort((a, b) => b.area - a.area)
    .filter((c) => {
      const key = c.text.toLowerCase()
      if (seenCta.has(key)) return false
      seenCta.add(key)
      return true
    })
    .slice(0, 3)
    .map(({ text: t, goesTo }) => ({ text: t, goesTo }))

  const booking = vendorIn(sources, BOOKING) ?? vendorIn(inlineScripts, INLINE_BOOKING)
  const chatButton = [...document.querySelectorAll('button, a, div[role=button], [class*=chat i]')]
    .some((el) => isVisible(el) && /^(live chat|chat( with us| now)?|text us|message us)$/i.test(innerTextOf(el).trim()))
  const chatFrame = iframes.find((f) => /chat|messag/i.test(`${f.id} ${classOf(f)} ${f.src} ${f.title}`))
  const chat = vendorIn(html, CHAT) ?? (chatFrame ? (/incontact/i.test(chatFrame.src) ? 'NICE CXone' : 'chat widget') : null) ?? (chatButton ? 'chat button' : null)

  const forms = [...document.querySelectorAll('form')].filter((f) =>
    f.querySelectorAll('input:not([type=hidden]):not([type=search]), textarea, select').length >= 2 && !f.querySelector('input[type=search]'))
  const reviewWidget = vendorIn(html, REVIEW_WIDGETS)
  const testimonials = /\b(testimonials?|what (our )?(patients|customers|clients) (are )?say(ing)?|google reviews?)\b|\b\d[\d,]*\+?\s+(google |5-star |five-star )?reviews?\b|\d(\.\d)?\s*(out of 5|stars?)\b/i.test(text.slice(0, 30000))

  const storeEvidence = allLinks.some((h) => {
    try {
      return /\/(shop|store|cart|products?)(\/|$)/i.test(new URL(h, location.href).pathname)
    } catch {
      return false
    }
  }) || /add to (cart|bag)/i.test(text)
  const orderingVendor = vendorIn(sources, ORDERING)
  const ordering = orderingVendor && STORE_PLATFORMS.has(orderingVendor) && !storeEvidence ? null : orderingVendor

  const payLink = [...document.querySelectorAll('a[href]')].some((a) => /pay (my|your) bill|make a payment|pay online|online payment/i.test(innerTextOf(a)))
  const portal = [...document.querySelectorAll('a[href]')]
    .map((a) => innerTextOf(a).trim().replace(/\s+/g, ' '))
    .find((t) => /patient portal|client portal|customer portal|patient login|client login|my account/i.test(t) && t.length < 40) ?? null

  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? '').join(' ')
  const seo = {
    title: document.title.trim().length > 0,
    metaDescription: (document.querySelector('meta[name=description]')?.getAttribute('content') ?? '').trim().length > 0,
    ogTags: Boolean(document.querySelector('meta[property^="og:"]')),
    localBusiness: /"@type"\s*:\s*\[?\s*"(LocalBusiness|Dentist|Plumber|Restaurant|HVACBusiness|Electrician|MedicalBusiness|MedicalClinic|Physician|FoodEstablishment|HomeAndConstructionBusiness|ProfessionalService|Store|Orthodontist|AutoRepair)"/i.test(jsonLd),
    h1: document.querySelectorAll('h1').length,
    canonical: Boolean(document.querySelector('link[rel=canonical]')),
  }

  const map = iframes.some((f) => /google\.com\/maps|maps\.google|mapbox|openstreetmap/i.test(f.src)) || /maps\.googleapis\.com\/maps\/api\/js/.test(html)
  const social = SOCIAL.filter(([, pattern]) => allLinks.some((h) => pattern.test(h))).map(([name]) => name)

  const fontCounts = new Map<string, number>()
  for (const el of [...document.querySelectorAll('h1,h2,h3,p,a,li,button')].slice(0, 1500)) {
    if (!isVisible(el)) continue
    const family = (getComputedStyle(el).fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim()
    fontCounts.set(family, (fontCounts.get(family) ?? 0) + innerTextOf(el).length)
  }
  const fonts = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([family]) => family)
  const years = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]))

  // How far the visitor can actually scroll sideways (capped at 600). overflow-x hidden or clip on
  // html/body blocks the visitor even though a programmatic scrollTo still moves, so check that first.
  const overflowPx = ((): number => {
    const blocked = [document.documentElement, document.body].some((el) => /hidden|clip/.test(getComputedStyle(el).overflowX))
    if (blocked) return 0
    const x = window.scrollX
    window.scrollTo(x + 600, window.scrollY)
    const moved = window.scrollX - x
    window.scrollTo(x, window.scrollY)
    return Math.max(0, moved)
  })()

  return {
    heroVideo,
    menuLinks: [...new Set(menuLinks)].slice(0, 12),
    menuButton,
    telLinks: telLinks.length,
    telInFold,
    phoneInText,
    ctas,
    booking,
    chat,
    contactForm: forms.length > 0,
    reviewWidget,
    testimonials,
    ordering,
    payments: allVendors(sources, PAYMENTS),
    payLink,
    analytics: allVendors(html, ANALYTICS),
    portal,
    fileUploads: document.querySelectorAll('input[type=file]').length,
    seo,
    viewportMeta: Boolean(document.querySelector('meta[name=viewport]')),
    map,
    social,
    platform: allVendors(html, PLATFORMS),
    generator: document.querySelector('meta[name=generator]')?.getAttribute('content') ?? null,
    fonts,
    copyright: years.length ? Math.max(...years) : null,
    images: document.images.length,
    screens: Math.round((document.documentElement.scrollHeight / vh) * 10) / 10,
    overflowPx,
  }
}
