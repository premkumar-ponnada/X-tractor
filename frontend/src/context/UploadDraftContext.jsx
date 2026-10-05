import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// Holds the files chosen on /jobs/new while the user configures SDKs on the next page.
// Files live in memory only (they cannot be serialised); a reload returns to step 1.
const UploadDraftContext = createContext(null)

const fileKey = (file) => `${file.name}:${file.size}:${file.lastModified}`

export function UploadDraftProvider({ children }) {
  const [files, setFiles] = useState([])

  const addFiles = useCallback((incoming) => {
    setFiles((current) => {
      const seen = new Set(current.map(fileKey))
      return [...current, ...incoming.filter((f) => !seen.has(fileKey(f)))]
    })
  }, [])
  const removeFile = useCallback((file) => setFiles((current) => current.filter((f) => fileKey(f) !== fileKey(file))), [])
  const clear = useCallback(() => setFiles([]), [])

  const value = useMemo(() => ({ files, addFiles, removeFile, clear, fileKey }), [files, addFiles, removeFile, clear])
  return <UploadDraftContext.Provider value={value}>{children}</UploadDraftContext.Provider>
}

export function useUploadDraft() {
  const context = useContext(UploadDraftContext)
  if (!context) throw new Error('useUploadDraft must be used inside UploadDraftProvider')
  return context
}
