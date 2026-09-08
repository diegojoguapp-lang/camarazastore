import { useRef, useState } from 'react'
import { getDisplayImageUrl, imageFallback } from '../../lib/utils'

export function ProductGallery({ product }) {
  const images = [product.main_image_url, ...(product.gallery_images || []).map((item) => item.image_url)].filter(Boolean)
  const uniqueImages = [...new Set(images)]
  const [active, setActive] = useState(0)
  const railRef = useRef(null)

  const select = (index) => {
    setActive(index)
    railRef.current?.children[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  const onScroll = () => {
    const rail = railRef.current
    if (!rail?.clientWidth) return
    setActive(Math.max(0, Math.min(uniqueImages.length - 1, Math.round(rail.scrollLeft / rail.clientWidth))))
  }

  return (
    <div className="sf-gallery">
      <div className="sf-gallery-rail" ref={railRef} onScroll={onScroll}>
        {(uniqueImages.length ? uniqueImages : ['/placeholder.svg']).map((url, index) => (
          <div className="sf-gallery-slide" key={`${url}-${index}`}>
            <img src={getDisplayImageUrl(url, { width: 960, height: 960, resize: 'contain' })} alt={`${product.name}${index ? `, imagen ${index + 1}` : ''}`} width="960" height="960" decoding="async" onError={imageFallback} />
          </div>
        ))}
      </div>
      {uniqueImages.length > 1 && <>
        <span className="sf-gallery-count">{active + 1} / {uniqueImages.length}</span>
        <div className="sf-gallery-thumbs">
          {uniqueImages.map((url, index) => <button key={url} type="button" aria-label={`Ver imagen ${index + 1}`} aria-pressed={active === index} onClick={() => select(index)}><img src={getDisplayImageUrl(url, { width: 120, height: 120, resize: 'contain' })} alt="" width="60" height="60" loading="lazy" decoding="async" onError={imageFallback} /></button>)}
        </div>
      </>}
    </div>
  )
}
