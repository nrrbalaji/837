import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  X,
  Check,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Power,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface Payer {
  payer_id: string;
  payer_code: string;
  payer_name: string;
  payer_type: string;
  trading_partner_id: string;
  electronic_payer_id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  fax: string;
  email: string;
  transmission_method: string;
  endpoint_url: string;
  sftp_config: SFTPConfig | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SFTPConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
}

const PayerMaster: React.FC = () => {
  const navigate = useNavigate();
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>("payer_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    payerType: "",
    transmissionMethod: "",
    state: "",
    isActive: "",
    dateFrom: "",
    dateTo: "",
  });

  const payerTypes = [
    "Medicare",
    "Medicaid",
    "Commercial",
    "Workers Comp",
    "Auto Insurance",
    "Other",
  ];
  const transmissionMethods = ["SFTP", "API", "HL7", "FHIR", "Manual"];
  const states = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ];

  useEffect(() => {
    fetchPayers();
  }, [currentPage, sortField, sortOrder, filters]);

  const fetchPayers = async () => {
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

      const response = await axios.get(`${API_BASE}/payers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPayers(response.data.payers || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching payers:", error);
      showToast("error", "Failed to fetch payers");
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

  const handleAddNew = () => {
    navigate("/payers/add");
  };

  const handleView = (payer: Payer) => {
    navigate(`/payers/view/${payer.payer_id}`);
  };

  const handleEdit = (payer: Payer) => {
    navigate(`/payers/edit/${payer.payer_id}`);
  };



  function handleDeactivate(payer_id: string): void {
    throw new Error("Function not implemented.");
  }

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
            <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Payer Master
              </h1>
              <p className="text-gray-600 mt-1">
                Manage insurance payer configurations and integrations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => alert("Import CSV feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-teal-400 transition-all shadow-sm"
            >
              <Upload size={18} />
              Import CSV
            </button>
            <button
              onClick={() => alert("Export CSV feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-teal-400 transition-all shadow-sm"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={() => alert("Bulk Deactivate feature")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-orange-300 text-orange-700 font-medium rounded-lg hover:bg-orange-50 hover:border-orange-500 transition-all shadow-sm"
            >
              <Power size={18} />
              Bulk Deactivate
            </button>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-cyan-800 transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Add New Payer
            </button>
          </div>
        </div>

        {/* Search/Filter Panel */}
        <div className="card shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="text-teal-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">
              Search & Filter
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                  placeholder="Name, Code, or Payer ID..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payer Type
              </label>
              <select
                value={filters.payerType}
                onChange={(e) =>
                  setFilters({ ...filters, payerType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
              >
                <option value="">All Types</option>
                {payerTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transmission
              </label>
              <select
                value={filters.transmissionMethod}
                onChange={(e) =>
                  setFilters({ ...filters, transmissionMethod: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
              >
                <option value="">All Methods</option>
                {transmissionMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <select
                value={filters.state}
                onChange={(e) =>
                  setFilters({ ...filters, state: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
              >
                <option value="">All States</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Payers Table */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading payers...</p>
          </div>
        ) : payers.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-700 font-medium mb-2">No payers found</p>
            <p className="text-sm text-gray-500 mb-6">
              Get started by adding your first payer
            </p>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-all"
            >
              <Plus size={18} />
              Add Payer
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-teal-50 to-cyan-50">
                  <tr>
                    {[
                      { field: "payer_name", label: "Payer Name" },
                      { field: "payer_code", label: "Code" },
                      { field: "payer_type", label: "Type" },
                      { field: "electronic_payer_id", label: "Electronic ID" },
                      { field: "trading_partner_id", label: "Trading Partner" },
                      { field: "transmission_method", label: "Transmission" },
                      { field: "city", label: "City" },
                      { field: "state", label: "State" },
                      { field: "is_active", label: "Active" },
                    ].map((col) => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-teal-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {col.label}
                          {sortField === col.field && (
                            <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payers.map((payer) => (
                    <tr
                      key={payer.payer_id}
                      className="hover:bg-teal-50 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <Building2 className="text-teal-600" size={20} />
                          </div>
                          <div className="font-semibold text-gray-900">
                            {payer.payer_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm font-mono text-gray-700">
                        {payer.payer_code}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {payer.payer_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {payer.electronic_payer_id}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {payer.trading_partner_id}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {payer.transmission_method}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {payer.city}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {payer.state}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            payer.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {payer.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleView(payer)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(payer)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeactivate(payer.payer_id)}
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

export default PayerMaster;
