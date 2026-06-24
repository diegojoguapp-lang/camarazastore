import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'
import { getHelpVideos } from '../lib/api'
import { getDisplayImageUrl, imageFallback } from '../lib/utils'

export function Ayuda() {
  const navigate = useNavigate()
  const [videos, setVideos] = useState([])

  useEffect(() => {
    getHelpVideos().then(setVideos)
  }, [])

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
              key={video.id || video.video_url}
              to={video.video_url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="course-thumb">
                <img src={getDisplayImageUrl(video.thumbnail_url, { width: 640, height: 360 })} alt="" width="640" height="360" loading="lazy" decoding="async" onError={imageFallback} />
                <span><PlayCircle size={34} /></span>
              </div>
              <h3>{video.title}</h3>
              {video.duration && <p>{video.duration}</p>}
            </Link>
          ))}
          {!videos.length && <div className="empty-state">Todavía no hay videos disponibles.</div>}
        </div>
      </section>
    </div>
  )
}
