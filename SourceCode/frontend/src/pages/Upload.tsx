import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Upload as UploadIcon, CheckCircle, AlertCircle, FileText, X, Sparkles, ShieldCheck, Zap } from 'lucide-react'

export default function Upload() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setSuccess(false)
      setError('')
      setUploadedFileId(null)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setSuccess(false)
      setError('')
      setUploadedFileId(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess(false)
    setUploadedFileId(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('/api/v1/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setSuccess(true)
      setUploadedFileId(response.data.file.file_id)
      setFile(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setSuccess(false)
    setError('')
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header with gradient */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <UploadIcon className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Upload 837 Claims
            </h1>
          </div>
        </div>
        <p className="text-lg text-gray-600 ml-15">Upload and process your healthcare claim files with automated validation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Upload Area */}
        <div className="lg:col-span-2">
          <div className="card shadow-lg border border-gray-200 overflow-hidden">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                dragActive
                  ? 'border-primary-500 bg-primary-50 scale-[1.02]'
                  : 'border-gray-300 bg-gradient-to-br from-gray-50 to-white hover:border-primary-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="relative">
                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mb-6 shadow-md transform transition-transform hover:scale-105">
                  <UploadIcon className="text-primary-600" size={48} />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {dragActive ? 'Drop your file here' : 'Upload your 837 claim file'}
                </h3>
                <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                  Drag and drop your file or click to browse
                  <br />
                  <span className="text-xs">Supports .txt, .x12, .edi, .837 formats (max 50MB)</span>
                </p>

                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".txt,.x12,.edi,.837,.dat"
                  className="hidden"
                  id="file-upload"
                />

                <label
                  htmlFor="file-upload"
                  className="btn-primary cursor-pointer inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:scale-105"
                >
                  <FileText size={18} />
                  Select File
                </label>

                {file && (
                  <div className="mt-6 p-5 bg-white border-2 border-primary-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center shadow-sm">
                          <FileText className="text-primary-600" size={28} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to upload
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={removeFile}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                        title="Remove file"
                      >
                        <X className="text-gray-400 group-hover:text-red-500 transition-colors" size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {success && uploadedFileId && (
              <div className="mt-4 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="text-green-600" size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-900 mb-1">Upload Successful!</p>
                    <p className="text-xs text-green-700">
                      Your file has been uploaded and processing has started.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/validation-logs?fileId=${uploadedFileId}`)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                >
                  <FileText size={16} />
                  View Validation Logs
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-5 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl flex items-start gap-3 shadow-sm">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="text-red-600" size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-900 mb-1">Upload Failed</p>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              </div>
            )}

            {file && !success && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="mt-4 w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed py-4 text-base font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Zap size={20} />
                    Upload and Process
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Sidebar - Features & Instructions */}
        <div className="space-y-6">
          {/* Features */}
          <div className="card shadow-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-primary-600" size={20} />
              <h3 className="text-lg font-semibold text-gray-900">Features</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="text-primary-600" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Automated Validation</p>
                  <p className="text-xs text-gray-600 mt-1">Real-time validation against X12 837 standards</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="text-green-600" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Fast Processing</p>
                  <p className="text-xs text-gray-600 mt-1">Process thousands of claims in seconds</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="text-purple-600" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto-Correction</p>
                  <p className="text-xs text-gray-600 mt-1">Intelligent error correction where possible</p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="card shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
            <ol className="space-y-3">
              {[
                'Select your 837 claim file',
                'File is validated automatically',
                'Review validation results',
                'Correct any errors if needed',
                'Transmit to payers',
              ].map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="text-sm text-gray-700 mt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
