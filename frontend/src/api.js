import axios from 'axios'

const BASE = 'http://localhost:8001'

export const uploadSong = (file, model, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', model)
  return axios.post(`${BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
}

export const getJobStatus = (jobId) =>
  axios.get(`${BASE}/job/${jobId}`)

export const getStemUrl = (jobId, stemName) =>
  `${BASE}/stems/${jobId}/${stemName}`

export const getDownloadUrl = (jobId) =>
  `${BASE}/download/${jobId}`

export const deleteJob = (jobId) =>
  axios.delete(`${BASE}/job/${jobId}`)

export const getSessions = () =>
  axios.get(`${BASE}/sessions`)
