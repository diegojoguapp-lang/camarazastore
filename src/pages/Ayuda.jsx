import { Link, useNavigate } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'

const videos = [
  {
    title: 'Cómo funciona Re-venta Camaraza Store',
    duration: '4 min',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo publicar productos en estados de WhatsApp',
    duration: '6 min',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo vender en Facebook Marketplace',
    duration: '7 min',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo pasar una venta por WhatsApp',
    duration: '3 min',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Cómo se pagan las comisiones',
    duration: '3 min',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  },
  {
    title: 'Qué hacer si el cliente pregunta por garantía',
    duration: '5 min',
    url: 'https://www.youtube.com/',
    thumb: '/placeholder.svg'
  }
]

export function Ayuda() {
  const navigate = useNavigate()
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="page help-page">
      <section className="container narrow">
        <button className="back-link plain-back" type="button" onClick={goBack}>
          ← Volver
        </button>
        <div className="simple-page-head">
          <h1>Videos de ayuda</h1>
          <p>Aprendé a vender paso a paso.</p>
        </div>
        <div className="course-video-list">
          {videos.map((video) => (
            <Link
              className="course-video-card"
              key={video.title}
              to={video.url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="course-thumb">
                <img src={video.thumb} alt="" />
                <span><PlayCircle size={34} /></span>
              </div>
              <h3>{video.title}</h3>
              {video.duration && <p>{video.duration}</p>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
