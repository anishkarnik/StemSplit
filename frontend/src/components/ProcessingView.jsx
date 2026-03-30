import { useEffect, useState } from 'react'
import { getJobStatus } from '../api'

export default function ProcessingView({ jobId, onDone, onError }) {
  const [status, setStatus] = useState('pending')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    let interval

    const poll = async () => {
      try {
        const res = await getJobStatus(jobId)
        const { status: s, progress: p, stems, error } = res.data
        setStatus(s)
        setProgress(p)

        if (s === 'done') {
          clearInterval(interval)
          setTimeout(() => onDone(stems), 600)
        } else if (s === 'error') {
          clearInterval(interval)
          setErrorMsg(error || 'Separation failed.')
        }
      } catch (e) {
        clearInterval(interval)
        setErrorMsg('Lost connection to backend.')
      }
    }

    poll()
    interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [jobId, onDone, onError])

  const STAGES = [
    { label: 'Uploading', threshold: 10 },
    { label: 'Loading AI model', threshold: 30 },
    { label: 'Separating stems', threshold: 80 },
    { label: 'Finalizing', threshold: 95 },
    { label: 'Done', threshold: 100 },
  ]
  const currentStage = STAGES.filter(s => progress >= s.threshold).pop()?.label || 'Starting'

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-10 text-center">
      {/* Animated logo */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"
          style={{ animationDuration: '1s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-3xl">🎵</div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Separating your song</h2>
        <p className="text-white/50 text-sm">{currentStage}...</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md space-y-2">
        <div className="flex justify-between text-xs text-white/40">
          <span>Processing</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {errorMsg ? (
        <div className="w-full max-w-md space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg text-left">
            <div className="font-semibold mb-1">Separation failed</div>
            <div className="text-xs text-red-300/80 font-mono break-all">{errorMsg}</div>
          </div>
          <button
            onClick={onError}
            className="w-full py-3 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all text-sm"
          >
            Try again
          </button>
        </div>
      ) : (
        <p className="text-xs text-white/30 max-w-sm">
          This may take 30–120 seconds depending on your hardware. First run will download the AI model (~80MB).
        </p>
      )}
    </div>
  )
}
