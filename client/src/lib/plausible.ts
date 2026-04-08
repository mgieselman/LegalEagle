const PLAUSIBLE_DEFAULT_SRC = 'https://plausible.io/js/script.js'

type PlausibleProps = Record<string, string | number | boolean>

const getPlausibleConfig = () => {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim()
  const src = import.meta.env.VITE_PLAUSIBLE_SRC?.trim() || PLAUSIBLE_DEFAULT_SRC

  if (!domain) {
    return null
  }

  return { domain, src }
}

export function initializePlausible() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const config = getPlausibleConfig()
  if (!config) {
    return
  }

  window.plausible =
    window.plausible ||
    ((eventName, options) => {
      const queue = window.plausible?.q || []
      queue.push([eventName, options])
      if (window.plausible) {
        window.plausible.q = queue
      }
    })

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[data-domain="${config.domain}"]`,
  )

  if (existingScript) {
    return
  }

  const script = document.createElement('script')
  script.defer = true
  script.dataset.domain = config.domain
  script.src = config.src

  document.head.appendChild(script)
}

export function trackPlausibleEvent(eventName: string, props?: PlausibleProps) {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim()
  if (!domain || typeof window === 'undefined' || typeof window.plausible !== 'function') {
    return
  }

  window.plausible(eventName, props ? { props } : undefined)
}