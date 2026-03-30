import { useState, useCallback } from 'react'
import Upload from './components/Upload'
import ProcessingView from './components/ProcessingView'
import StemPlayer from './components/StemPlayer'

export default function App() {
  const [view, setView] = useState('upload') // 'upload' | 'processing' | 'player'
  const [jobId, setJobId] = useState(null)
  const [stems, setStems] = useState([])

  const handleUploadSuccess = (id) => {
    setJobId(id)
    setView('processing')
  }

  const handleProcessingDone = useCallback((stemList) => {
    setStems(stemList)
    setView('player')
  }, [])

  const handleReset = useCallback(() => {
    setJobId(null)
    setStems([])
    setView('upload')
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-sm font-bold">S</div>
          <span className="text-lg font-semibold tracking-tight">StemSplit</span>
        </div>
        <span className="text-xs text-white/40">AI Music Separator — runs locally</span>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {view === 'upload' && (
          <Upload onSuccess={handleUploadSuccess} />
        )}
        {view === 'processing' && (
          <ProcessingView jobId={jobId} onDone={handleProcessingDone} onError={handleReset} />
        )}
        {view === 'player' && (
          <StemPlayer jobId={jobId} stems={stems} onReset={handleReset} />
        )}
      </main>
    </div>
  )
}
