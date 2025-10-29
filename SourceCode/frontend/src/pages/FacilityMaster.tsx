import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
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
  X,
  Check,
  AlertCircle,
  Building,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface Facility {
  facility_id: string;
  facility_code: string;
  facility_name: string;
  npi: string;
  tax_id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  fax: string;
  email: string;
  facility_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ingestion_mode?: string;
  ingestion_config?: any;
  data_format?: "FHIR" | "HL7";
  sftp_config?: {
    host?: string;
    port?: number;
    username?: string;
    auth_method?: "password" | "ssh_key";
    password?: string;
    private_key_path?: string;
    input_folder?: string;
    output_folder?: string;
    archive_folder?: string;
    poll_interval_seconds?: number;
    enabled?: boolean;
  };
  local_config?: {
    input_folder?: string;
    output_folder?: string;
    archive_folder?: string;
    watch_recursive?: boolean;
    debounce_milliseconds?: number;
    enabled?: boolean;
  };
}



const FacilityMaster: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>("facility_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    facilityType: "",
    state: "",
    isActive: "",
  });

  const facilityTypes = [
    "Hospital",
    "Clinic",
    "Urgent Care",
    "Surgery Center",
    "Imaging Center",
    "Laboratory",
    "Rehabilitation Center",
    "Nursing Home",
    "Home Health",
    "Other",
  ];

  useEffect(() => {
    fetchFacilities();
  }, [currentPage, sortField, sortOrder, filters]);

  const fetchFacilities = async () => {
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

      const response = await axios.get(`${API_BASE}/facilities?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setFacilities(response.data.facilities || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching facilities:", error);
      showToast("error", "Failed to fetch facilities");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: "success" | "error" | "info", message: string) => {
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

  const handleAddNew = () => {
    navigate("/facilities/add");
  };

  const handleView = (facility: Facility) => {
    navigate(`/facilities/view/${facility.facility_id}`);
  };

  const handleEdit = (facility: Facility) => {
    navigate(`/facilities/edit/${facility.facility_id}`);
  };

  const handleDeactivate = async (facilityId: string) => {
    if (window.confirm("Are you sure you want to deactivate this facility?")) {
      try {
        const token = localStorage.getItem("token");
        await axios.patch(`${API_BASE}/facilities/${facilityId}`, {
          is_active: false
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Facility deactivated successfully");
        fetchFacilities(); // Refresh the list
      } catch (error) {
        console.error("Error deactivating facility:", error);
        showToast("error", "Failed to deactivate facility");
      }
    }
  };



  return (
    <div className="max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg transform transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-blue-600 text-white"
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
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Facility Master
              </h1>
              <p className="text-gray-600 mt-1">
                Manage healthcare facility configurations and locations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => alert("Import CSV feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-all shadow-sm"
            >
              <Upload size={18} />
              Import CSV
            </button>
            <button
              onClick={() => alert("Export CSV feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-all shadow-sm"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={() => alert("Bulk Re-link feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-purple-300 text-purple-700 font-medium rounded-lg hover:bg-purple-50 hover:border-purple-500 transition-all shadow-sm"
            >
              <RefreshCw size={18} />
              Bulk Re-link
            </button>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Add New Facility
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Name, Code, NPI, Tax ID..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Facility Type
              </label>
              <select
                value={filters.facilityType}
                onChange={(e) =>
                  setFilters({ ...filters, facilityType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Types</option>
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
                value={filters.isActive}
                onChange={(e) =>
                  setFilters({ ...filters, isActive: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner for Non-Admin Users */}
      {user && !user.isAdmin && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Info className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Showing facilities assigned to you
              </h3>
              <p className="text-sm text-blue-700">
                You are viewing {facilities.length} facilit{facilities.length === 1 ? 'y' : 'ies'} that {facilities.length === 1 ? 'has' : 'have'} been assigned to your account.
                Contact your administrator to request access to additional facilities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Facilities Table */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading facilities...</p>
          </div>
        ) : facilities.length === 0 ? (
          <div className="p-12 text-center">
            <Building className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-700 font-medium mb-2">
              No facilities found
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Get started by adding your first facility
            </p>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all"
            >
              <Plus size={18} />
              Add Facility
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {[
                      { field: "facility_name", label: "Facility Name" },
                      { field: "facility_code", label: "Code" },
                      { field: "npi", label: "NPI" },
                      { field: "tax_id", label: "Tax ID" },
                      { field: "facility_type", label: "Type" },
                      { field: "city", label: "City" },
                      { field: "state", label: "State" },
                      { field: "is_active", label: "Active" },
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
                  {facilities.map((facility) => (
                    <tr
                      key={facility.facility_id}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building className="text-blue-600" size={20} />
                          </div>
                          <div className="font-semibold text-gray-900">
                            {facility.facility_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {facility.facility_code}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {facility.npi}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {facility.tax_id}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {facility.facility_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {facility.city}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {facility.state}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            facility.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {facility.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(facility)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(facility)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() =>
                              handleDeactivate(facility.facility_id)
                            }
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Deactivate"
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

export default FacilityMaster;
