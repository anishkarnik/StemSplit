import { useEffect, useRef, useState, useCallback } from 'react'
import { Howl } from 'howler'
import StemTrack from './StemTrack'
import { getStemUrl, getDownloadUrl, deleteJob } from '../api'

const STEM_COLORS = {
  vocals: '#EC4899',
  drums: '#F59E0B',
  bass: '#3B82F6',
  other: '#10B981',
  guitar: '#F97316',
  piano: '#8B5CF6',
}

const STEM_ICONS = {
  vocals: '🎤',
  drums: '🥁',
  bass: '🎸',
  other: '🎼',
  guitar: '🎸',
  piano: '🎹',
}

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function StemPlayer({ jobId, stems, onReset }) {
  const howlsRef = useRef({}) // stem -> Howl instance
  const [playing, setPlaying] = useState(false)
  const [seek, setSeek] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loaded, setLoaded] = useState({})
  const [volumes, setVolumes] = useState(() =>
    Object.fromEntries(stems.map((s) => [s, 1]))
  )
  const [muted, setMuted] = useState(() =>
    Object.fromEntries(stems.map((s) => [s, false]))
  )
  const [soloed, setSoloed] = useState(null)
  const seekIntervalRef = useRef(null)

  // Load all Howl instances
  useEffect(() => {
    const newLoaded = {}

    stems.forEach((stem) => {
      const url = getStemUrl(jobId, stem)
      const howl = new Howl({
        src: [url],
        format: ['wav'],
        html5: true,
        onload: () => {
          newLoaded[stem] = true
          if (Object.keys(newLoaded).length === stems.length) {
            setDuration(howl.duration())
            setLoaded({ ...newLoaded })
          }
        },
        onloaderror: (_id, err) => {
          console.error(`Failed to load stem "${stem}":`, err)
          newLoaded[stem] = true
          if (Object.keys(newLoaded).length === stems.length) {
            setLoaded({ ...newLoaded })
          }
        },
      })
      howlsRef.current[stem] = howl
    })

    return () => {
      clearInterval(seekIntervalRef.current)
      Object.values(howlsRef.current).forEach((h) => { h.stop(); h.unload() })
      howlsRef.current = {}
    }
  }, [jobId, stems])

  const syncSeek = useCallback(() => {
    if (!stems.length) return
    const firstHowl = howlsRef.current[stems[0]]
    if (firstHowl) setSeek(firstHowl.seek())
  }, [stems])

  const togglePlay = useCallback(() => {
    const howls = Object.values(howlsRef.current)
    if (playing) {
      howls.forEach((h) => h.pause())
      clearInterval(seekIntervalRef.current)
      setPlaying(false)
    } else {
      howls.forEach((h) => h.play())
      seekIntervalRef.current = setInterval(syncSeek, 250)
      setPlaying(true)
    }
  }, [playing, syncSeek])

  const handleSeek = useCallback((val) => {
    const secs = (val / 100) * duration
    Object.values(howlsRef.current).forEach((h) => h.seek(secs))
    setSeek(secs)
  }, [duration])

  const setVolume = useCallback((stem, vol) => {
    setVolumes((prev) => ({ ...prev, [stem]: vol }))
    const h = howlsRef.current[stem]
    if (h) h.volume(soloed && soloed !== stem ? 0 : vol)
  }, [soloed])

  const toggleMute = useCallback((stem) => {
    setMuted((prev) => {
      const next = { ...prev, [stem]: !prev[stem] }
      const h = howlsRef.current[stem]
      if (h) h.mute(next[stem])
      return next
    })
  }, [])

  const toggleSolo = useCallback((stem) => {
    setSoloed((prev) => {
      const newSolo = prev === stem ? null : stem
      stems.forEach((s) => {
        const h = howlsRef.current[s]
        if (h) {
          if (newSolo) {
            h.volume(s === newSolo ? volumes[s] : 0)
          } else {
            h.volume(volumes[s])
            h.mute(muted[s])
          }
        }
      })
      return newSolo
    })
  }, [stems, volumes, muted])

  const handleReset = async () => {
    try { await deleteJob(jobId) } catch {}
    onReset()
  }

  const handleDownloadAll = async () => {
    const url = getDownloadUrl(jobId)
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `stems_${jobId.slice(0, 8)}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const allLoaded = stems.length > 0 && stems.every((s) => loaded[s])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Stems Ready</h2>
          <p className="text-sm text-white/50">{stems.length} tracks separated</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:border-white/40 text-white/70 hover:text-white transition-all"
          >
            ↓ Download All
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm rounded-lg border border-white/20 hover:border-red-500/50 text-white/70 hover:text-red-400 transition-all"
          >
            New Song
          </button>
        </div>
      </div>

      {!allLoaded && (
        <div className="text-center py-8 text-white/40 text-sm">Loading audio...</div>
      )}

      {allLoaded && (
        <>
          {/* Master controls */}
          <div className="bg-white/5 rounded-2xl p-5 space-y-4 border border-white/10">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xl hover:scale-105 transition-transform flex-shrink-0"
              >
                {playing ? '⏸' : '▶'}
              </button>
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={duration ? (seek / duration) * 100 : 0}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none bg-white/20 rounded-full cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-white/40">
                  <span>{formatTime(seek)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stem tracks */}
          <div className="space-y-3">
            {stems.map((stem) => (
              <StemTrack
                key={stem}
                stem={stem}
                jobId={jobId}
                color={STEM_COLORS[stem] || '#7C3AED'}
                icon={STEM_ICONS[stem] || '🎵'}
                volume={volumes[stem]}
                isMuted={muted[stem]}
                isSoloed={soloed === stem}
                onVolume={(v) => setVolume(stem, v)}
                onMute={() => toggleMute(stem)}
                onSolo={() => toggleSolo(stem)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
