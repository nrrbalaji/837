import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Search, Eye, ChevronUp, ChevronDown } from 'lucide-react'

interface Claim {
  claim_id: string
  claim_number: string
  claim_status: string
  validation_status: string
  total_charge: number
  service_date_from: string
  facility_name: string
  payer_name: string
  provider_name: string
}



export default function Claims() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ by: 'created_at', order: 'desc' as 'asc' | 'desc' })

  useEffect(() => {
    fetchClaims()
  }, [search, sort.by, sort.order])

  const fetchClaims = async () => {
    try {
      const params: any = { page: 1, limit: 50, sortBy: sort.by, sortOrder: sort.order }
      if (search) params.search = search

      const response = await axios.get('/api/v1/claims', { params })
      setClaims(response.data.claims || [])
    } catch (error) {
      console.error('Error fetching claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      VALIDATED: 'bg-blue-100 text-blue-800',
      CORRECTED: 'bg-green-100 text-green-800',
      TRANSMITTED: 'bg-purple-100 text-purple-800',
      REJECTED: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  const handleSort = (column: string) => {
    setSort(prevSort => {
      if (prevSort.by === column) {
        return { by: column, order: prevSort.order === 'asc' ? 'desc' : 'asc' }
      } else {
        return { by: column, order: 'asc' }
      }
    })
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Claims</h1>
        <Link to="/upload" className="btn-primary">
          Upload Claims
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search claims..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Claims Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading claims...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No claims found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('claim_number')}
                  >
                    <div className="flex items-center gap-1">
                      Claim Number
                      {sort.by === 'claim_number' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('facility_name')}
                  >
                    <div className="flex items-center gap-1">
                      Facility
                      {sort.by === 'facility_name' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('payer_name')}
                  >
                    <div className="flex items-center gap-1">
                      Payer
                      {sort.by === 'payer_name' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('service_date_from')}
                  >
                    <div className="flex items-center gap-1">
                      Service Date
                      {sort.by === 'service_date_from' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('total_charge')}
                  >
                    <div className="flex items-center gap-1">
                      Amount
                      {sort.by === 'total_charge' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('claim_status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sort.by === 'claim_status' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('validation_status')}
                  >
                    <div className="flex items-center gap-1">
                      Validation
                      {sort.by === 'validation_status' && (
                        sort.order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {claims.map((claim) => (
                  <tr key={claim.claim_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {claim.claim_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {claim.facility_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {claim.payer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(claim.service_date_from).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${claim.total_charge.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(claim.claim_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(claim.validation_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/claims/${claim.claim_id}`}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Eye size={18} className="inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
