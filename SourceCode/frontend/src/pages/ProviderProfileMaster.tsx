import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Plus,
  Upload,
  Download,
  RefreshCw,
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  Building2,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Users,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface Provider {
  provider_id: string;
  provider_name: string;
  npi: string;
  tax_id: string;
  facility_type: string;
  taxonomy_code: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: "Active" | "Inactive" | "Pending";
  created_at: string;
  updated_at: string;
  payer_mappings?: PayerMapping[];
}

interface PayerMapping {
  payer_mapping_id?: string;
  payer_name: string;
  payer_id: string;
  enrollment_status: string;
  effective_date: string;
  termination_date?: string;
}



const ProviderProfileMaster: React.FC = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>("provider_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    providerName: "",
    npi: "",
    taxId: "",
    facilityType: "",
    status: "",
  });

  useEffect(() => {
    fetchProviders();
  }, [currentPage, sortField, sortOrder, filters]);



  const fetchProviders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        sortField,
        sortOrder,
        ...filters,
      });

      const response = await axios.get(`${API_BASE}/providers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProviders(response.data.providers || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching providers:", error);
      showToast("error", "Failed to fetch providers");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/providers/${providerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast("success", "Provider deleted successfully");
      fetchProviders();
    } catch (error) {
      showToast("error", "Failed to delete provider");
    }
  };

  const facilityTypes = [
    "Cardiology",
    "Dermatology",
    "Emergency Medicine",
    "Family Medicine",
    "Internal Medicine",
    "Neurology",
    "Obstetrics & Gynecology",
    "Ophthalmology",
    "Orthopedic Surgery",
    "Pediatrics",
    "Psychiatry",
    "Radiology",
    "Surgery",
    "Urology",
    "Other",
  ];
  const statuses = ["Active", "Inactive", "Pending"];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg transform transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-4 hover:opacity-75"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Provider Profile Master
              </h1>
              <p className="text-gray-600 mt-1">
                Manage provider configurations for claim validation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => alert("Import/Export feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-all shadow-sm"
            >
              <Upload size={18} />
              Import
            </button>
            <button
              onClick={() => alert("Export feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-all shadow-sm"
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={() => alert("Sync from EHR")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-blue-300 text-blue-700 font-medium rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-all shadow-sm"
            >
              <RefreshCw size={18} />
              Sync from EHR
            </button>
            <button
              onClick={() => navigate("/providers/add")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Add New Provider
            </button>
          </div>
        </div>

        {/* Search/Filter Panel */}
        <div className="card shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">
              Search & Filter
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider Name
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={filters.providerName}
                  onChange={(e) =>
                    setFilters({ ...filters, providerName: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NPI
              </label>
              <input
                type="text"
                placeholder="Enter NPI..."
                value={filters.npi}
                onChange={(e) =>
                  setFilters({ ...filters, npi: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tax ID
              </label>
              <input
                type="text"
                placeholder="Enter Tax ID..."
                value={filters.taxId}
                onChange={(e) =>
                  setFilters({ ...filters, taxId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialty
              </label>
              <select
                value={filters.facilityType}
                onChange={(e) =>
                  setFilters({ ...filters, facilityType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Specialties</option>
                {facilityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Providers Table */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading providers...</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-700 font-medium mb-2">No providers found</p>
            <p className="text-sm text-gray-500 mb-6">
              Get started by adding your first provider
            </p>
            <button
              onClick={() => navigate("/providers/add")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all"
            >
              <Plus size={18} />
              Add Provider
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {[
                      { field: "provider_name", label: "Provider Name" },
                      { field: "npi", label: "NPI" },
                      { field: "tax_id", label: "Tax ID" },
                      { field: "facility_type", label: "Specialty" },
                      { field: "taxonomy_code", label: "Taxonomy" },
                      { field: "address", label: "Address" },
                      { field: "status", label: "Status" },
                    ].map((col) => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {col.label}
                          {sortField === col.field && (
                            <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {providers.map((provider) => (
                    <tr
                      key={provider.provider_id}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="text-blue-600" size={20} />
                          </div>
                          <div className="font-semibold text-gray-900">
                            {provider.provider_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {provider.npi}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {provider.tax_id}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {provider.facility_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {provider.taxonomy_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {provider.city}, {provider.state}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            provider.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : provider.status === "Inactive"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {provider.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/providers/view/${provider.provider_id}`)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => navigate(`/providers/edit/${provider.provider_id}`)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(provider.provider_id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700 font-medium">
                  Page <span className="font-bold">{currentPage}</span> of{" "}
                  <span className="font-bold">{totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>


    </div>
  );
};

export default ProviderProfileMaster;
