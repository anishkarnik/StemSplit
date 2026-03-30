import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { getStemUrl } from '../api'

export default function StemTrack({
  stem, jobId, color, icon,
  volume, isMuted, isSoloed,
  onVolume, onMute, onSolo
}) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    wsRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: `${color}44`,
      progressColor: color,
      height: 48,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 0,
      interact: false,
      url: getStemUrl(jobId, stem),
      volume: 0,
      muted: true,
    })

    return () => wsRef.current?.destroy()
  }, [jobId, stem, color])

  const stemLabel = stem.charAt(0).toUpperCase() + stem.slice(1)

  const handleDownload = async () => {
    const url = getStemUrl(jobId, stem)
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${stem}.wav`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        isMuted
          ? 'border-white/5 bg-white/5 opacity-50'
          : isSoloed
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {/* Stem label */}
      <div className="flex-shrink-0 w-24">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="text-sm font-semibold" style={{ color }}>{stemLabel}</div>
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div ref={containerRef} className="flex-1 wavesurfer-wrapper min-w-0" />

      {/* Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Volume */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="w-20 h-1 appearance-none cursor-pointer accent-purple-400"
          title="Volume"
        />

        {/* Mute */}
        <button
          onClick={onMute}
          title="Mute"
          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
            isMuted
              ? 'bg-red-500/30 text-red-400 border border-red-500/50'
              : 'bg-white/10 text-white/60 border border-white/10 hover:border-white/30'
          }`}
        >
          M
        </button>

        {/* Solo */}
        <button
          onClick={onSolo}
          title="Solo"
          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
            isSoloed
              ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/50'
              : 'bg-white/10 text-white/60 border border-white/10 hover:border-white/30'
          }`}
        >
          S
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          title="Download stem"
          className="w-8 h-8 rounded-lg text-xs bg-white/10 text-white/60 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all"
        >
          ↓
        </button>
      </div>
    </div>
  )
}
