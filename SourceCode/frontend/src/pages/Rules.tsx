import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react'

export default function Rules() {
  const navigate = useNavigate()
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const response = await axios.get('/api/v1/rules/validation')
      setRules(response.data)
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRule = () => {
    navigate('/rules/add')
  }

  const handleEditRule = (ruleId: string) => {
    navigate(`/rules/edit/${ruleId}`)
  }

  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    if (!confirm(`Are you sure you want to delete rule "${ruleName}"?`)) return

    try {
      await axios.delete(`/api/v1/rules/validation/${ruleId}`)
      alert('Rule deleted successfully')
      fetchRules()
    } catch (error) {
      console.error('Error deleting rule:', error)
      alert('Failed to delete rule')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Validation Rules</h1>
        <div className="flex gap-3">
          <button
            onClick={fetchRules}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleAddRule}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add New Rule
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading rules...</p>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No validation rules found</p>
            <button
              onClick={handleAddRule}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rule Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rules.map((rule) => (
                  <tr key={rule.rule_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {rule.rule_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{rule.rule_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{rule.rule_category}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          rule.severity === 'ERROR'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {rule.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          rule.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRule(rule.rule_id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Rule"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.rule_id, rule.rule_name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
