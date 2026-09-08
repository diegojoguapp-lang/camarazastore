import { useEffect } from 'react'
import { STORE_NAME, STORE_ORIGIN } from './config'

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
}

export function useStoreSeo({ title, description, canonical = STORE_ORIGIN, image = '', type = 'website' }) {
  useEffect(() => {
    const fullTitle = title?.includes(STORE_NAME) ? title : `${title} | ${STORE_NAME}`
    document.title = fullTitle
    ensureMeta('meta[name="description"]', { name: 'description', content: description })
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: type })
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' })
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    if (image) {
      ensureMeta('meta[property="og:image"]', { property: 'og:image', content: image })
      ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
    } else {
      document.head.querySelector('meta[property="og:image"]')?.remove()
      document.head.querySelector('meta[name="twitter:image"]')?.remove()
    }
    let link = document.head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = canonical
  }, [canonical, description, image, title, type])
}
