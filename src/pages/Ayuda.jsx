import { PlayCircle } from 'lucide-react'

const videos = [
  {
    title: 'Cómo funciona Re-venta Camaraza Store',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo publicar productos en estados de WhatsApp',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo vender en Facebook Marketplace',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo pasar una venta por WhatsApp',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo se pagan las comisiones',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Qué hacer si el cliente pregunta por garantía',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  }
]

export function Ayuda() {
  return (
    <div className="page">
      <section className="container">
        <div className="simple-page-head">
          <p className="eyebrow">Aprendé a vender</p>
          <h1>Videos de ayuda</h1>
        </div>
        <div className="video-list">
          {videos.map((video) => (
            <article className="video-card" key={video.title}>
              <img src={video.thumb} alt="" />
              <div>
                <h3>{video.title}</h3>
                <a className="secondary-button" href={video.url} target="_blank" rel="noreferrer">
                  <PlayCircle size={17} />
                  Ver video
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
