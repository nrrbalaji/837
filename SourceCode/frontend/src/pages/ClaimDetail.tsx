import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'

export default function ClaimDetail() {
  const { id } = useParams()
  const [claim, setClaim] = useState<any>(null)
  const [validations, setValidations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClaimDetail()
    fetchValidations()
  }, [id])

  const fetchClaimDetail = async () => {
    try {
      const response = await axios.get(`/api/v1/claims/${id}`)
      setClaim(response.data)
    } catch (error) {
      console.error('Error fetching claim:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchValidations = async () => {
    try {
      const response = await axios.get(`/api/v1/validations/${id}`)
      setValidations(response.data)
    } catch (error) {
      console.error('Error fetching validations:', error)
    }
  }

  const handleValidate = async () => {
    try {
      await axios.post(`/api/v1/claims/${id}/validate`)
      fetchClaimDetail()
      fetchValidations()
    } catch (error) {
      console.error('Validation error:', error)
    }
  }

  const handleAutoCorrect = async () => {
    try {
      setLoading(true)
      await axios.post(`/api/v1/claims/${id}/revalidate`)
      await fetchClaimDetail()
      await fetchValidations()
    } catch (error) {
      console.error('Re-validation error:', error)
      alert('Failed to re-validate claim. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading claim details...</div>
  }

  if (!claim) {
    return <div className="text-center py-12">Claim not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          Claim {claim.claim_number}
        </h1>
        <div className="flex gap-2">
          <button onClick={handleValidate} className="btn-secondary">
            Validate
          </button>
          <button onClick={handleAutoCorrect} className="btn-primary" disabled={loading}>
            {loading ? 'Re-Validating...' : 'Re-Validate Claim'}
          </button>
        </div>
      </div>

      {/* Claim Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
          <p className="text-lg font-semibold text-gray-900">{claim.claim_status}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Validation</h3>
          <p className="text-lg font-semibold text-gray-900">{claim.validation_status}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Charge</h3>
          <p className="text-lg font-semibold text-gray-900">
            ${claim.total_charge?.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Validation Errors */}
      {validations.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Validation Issues
          </h2>
          <div className="space-y-3">
            {validations.map((validation, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  validation.severity === 'ERROR'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start">
                  <AlertCircle
                    className={`${
                      validation.severity === 'ERROR' ? 'text-red-600' : 'text-yellow-600'
                    } mr-2 flex-shrink-0`}
                    size={20}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{validation.rule_name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{validation.error_message}</p>
                    {validation.suggestion && (
                      <p className="text-sm text-gray-500 mt-1 italic">
                        Suggestion: {validation.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Lines */}
      {claim.service_lines && claim.service_lines.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Lines</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Line</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Procedure</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Charge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {claim.service_lines.map((line: any) => (
                  <tr key={line.line_id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{line.line_number}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{line.procedure_code}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{line.quantity}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      ${line.total_charge?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
