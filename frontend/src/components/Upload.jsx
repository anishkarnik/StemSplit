import { useState, useRef, useCallback, useEffect } from 'react'
import { uploadSong, getSessions, deleteJob, getCudaStatus } from '../api'

const MODELS = [
  { id: 'htdemucs', label: '4 Stems', description: 'Vocals · Drums · Bass · Other', icon: '🎵' },
  { id: 'htdemucs_6s', label: '6 Stems', description: 'Vocals · Drums · Bass · Guitar · Piano · Other', icon: '🎹' },
]

const QUALITIES = [
  { id: 'lossless', label: 'Lossless', description: 'WAV · Full quality', size: '~50 MB/stem' },
  { id: 'high',     label: 'High',     description: 'MP3 320k · Transparent', size: '~12 MB/stem' },
  { id: 'medium',   label: 'Medium',   description: 'MP3 192k · Excellent', size: '~7 MB/stem' },
]

const ACCEPTED = '.mp3,.wav,.flac,.m4a,.ogg,.aac'

const STEM_COLORS = {
  vocals: '#EC4899', drums: '#F59E0B', bass: '#3B82F6',
  other: '#10B981', guitar: '#F97316', piano: '#8B5CF6',
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Upload({ onSuccess, onOpenSession }) {
  const [model, setModel] = useState('htdemucs')
  const [quality, setQuality] = useState('medium')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [sessions, setSessions] = useState([])
  const [cudaStatus, setCudaStatus] = useState({ available: false, name: '' })
  const inputRef = useRef(null)

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.data))
      .catch(() => {})

    getCudaStatus()
      .then((res) => {
        setCudaStatus({
          available: res.data.cuda_available,
          name: res.data.device_name
        })
      })
      .catch(() => {})
  }, [])

  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'].includes(ext)) {
      setError('Unsupported format. Please use MP3, WAV, FLAC, M4A, OGG, or AAC.')
      return
    }
    setError(null)
    setFile(f)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const res = await uploadSong(file, model, quality, setUploadProgress)
      onSuccess(res.data.job_id)
    } catch (e) {
      setError(e.response?.data?.detail || 'Upload failed. Make sure the backend is running.')
      setUploading(false)
    }
  }

  const handleDeleteSession = async (e, jobId) => {
    e.stopPropagation()
    try { await deleteJob(jobId) } catch {}
    setSessions((prev) => prev.filter((s) => s.job_id !== jobId))
  }

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-8">
      {/* Hero text */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Separate Any Song
        </h1>
        <p className="text-white/50 text-lg max-w-lg mx-auto">
          Isolate vocals, drums, bass and instruments with AI. Powered by Demucs v4.
        </p>

        {/* CUDA Status Badge */}
        <div className="flex justify-center mt-2">
          {cudaStatus.available ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Hardware Acceleration Active: {cudaStatus.name}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              Running on CPU
            </div>
          )}
        </div>
      </div>

      {/* Model selector */}
      <div>
        <p className="text-sm font-medium text-white/60 mb-3">Separation mode</p>
        <div className="grid grid-cols-2 gap-3">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                model === m.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="text-xl mb-1">{m.icon}</div>
              <div className="font-semibold text-sm">{m.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{m.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quality selector */}
      <div>
        <p className="text-sm font-medium text-white/60 mb-3">Output quality</p>
        <div className="grid grid-cols-3 gap-3">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuality(q.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                quality === q.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="font-semibold text-sm">{q.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{q.description}</div>
              <div className="text-xs text-white/30 mt-0.5">{q.size}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !file && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          dragging
            ? 'border-purple-400 bg-purple-500/10'
            : file
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-white/20 hover:border-white/40 bg-white/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="space-y-2">
            <div className="text-4xl">🎵</div>
            <div className="font-semibold text-green-400">{file.name}</div>
            <div className="text-sm text-white/40">{formatSize(file.size)}</div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="text-xs text-white/30 hover:text-white/60 mt-2 underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">🎧</div>
            <div className="text-white/70 font-medium">Drop your song here</div>
            <div className="text-sm text-white/40">or click to browse</div>
            <div className="text-xs text-white/30 mt-2">MP3 · WAV · FLAC · M4A · OGG · AAC (max 100MB)</div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload button */}
      {file && (
        <div className="space-y-3">
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/50">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white"
          >
            {uploading ? 'Uploading...' : '✨ Separate Stems'}
          </button>
        </div>
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-white/60">Recent sessions</p>
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.job_id}
                onClick={() => onOpenSession(s.job_id, s.stems)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left group"
              >
                <div className="text-2xl flex-shrink-0">🎵</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/90 truncate">{s.filename}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {s.stems.map((stem) => (
                        <span
                          key={stem}
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: `${STEM_COLORS[stem] || '#7C3AED'}22`, color: STEM_COLORS[stem] || '#7C3AED' }}
                        >
                          {stem}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-white/30">{formatDate(s.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.job_id)}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all text-lg leading-none flex-shrink-0 px-1"
                  title="Delete session"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
