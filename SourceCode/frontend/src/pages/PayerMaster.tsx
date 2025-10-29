import React, { useState, useEffect } from "react";
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
  X,
  Check,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Wifi,
  Clock,
  Power,
  Loader,
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
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "contact" | "transmission" | "metadata"
  >("general");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>("payer_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

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

  // Form states
  const [formData, setFormData] = useState<Partial<Payer>>({
    payer_code: "",
    payer_name: "",
    payer_type: "",
    trading_partner_id: "",
    electronic_payer_id: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    phone: "",
    fax: "",
    email: "",
    transmission_method: "SFTP",
    endpoint_url: "",
    sftp_config: null,
    is_active: true,
  });

  const [sftpConfig, setSftpConfig] = useState<SFTPConfig>({
    host: "",
    port: 22,
    username: "",
    password: "",
    privateKey: "",
    remotePath: "/",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

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

  const openAddModal = () => {
    setModalMode("add");
    setFormData({
      payer_code: "",
      payer_name: "",
      payer_type: payerTypes[0],
      trading_partner_id: "",
      electronic_payer_id: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      fax: "",
      email: "",
      transmission_method: "SFTP",
      endpoint_url: "",
      sftp_config: null,
      is_active: true,
    });
    setSftpConfig({
      host: "",
      port: 22,
      username: "",
      password: "",
      privateKey: "",
      remotePath: "/",
    });
    setNotes("");
    setErrors({});
    setActiveTab("general");
    setShowModal(true);
  };

  const openEditModal = (payer: Payer) => {
    setModalMode("edit");
    setSelectedPayer(payer);
    setFormData(payer);
    if (payer.sftp_config) {
      setSftpConfig(payer.sftp_config);
    }
    setActiveTab("general");
    setShowModal(true);
  };

  const openViewModal = (payer: Payer) => {
    setModalMode("view");
    setSelectedPayer(payer);
    setFormData(payer);
    if (payer.sftp_config) {
      setSftpConfig(payer.sftp_config);
    }
    setActiveTab("general");
    setShowModal(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.payer_code?.trim())
      newErrors.payer_code = "Payer code is required";
    if (!formData.payer_name?.trim())
      newErrors.payer_name = "Payer name is required";
    if (!formData.payer_type) newErrors.payer_type = "Payer type is required";
    if (!formData.electronic_payer_id?.trim())
      newErrors.electronic_payer_id = "Electronic payer ID is required";

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (formData.zip_code && !/^\d{5}(-\d{4})?$/.test(formData.zip_code)) {
      newErrors.zip_code = "Invalid ZIP code format";
    }

    if (
      formData.endpoint_url &&
      !/^https?:\/\/.+/.test(formData.endpoint_url)
    ) {
      newErrors.endpoint_url = "Invalid URL format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showToast("error", "Please fix validation errors");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        sftp_config:
          formData.transmission_method === "SFTP" ? sftpConfig : null,
        notes,
      };

      if (modalMode === "add") {
        await axios.post(`${API_BASE}/payers`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Payer added successfully");
      } else if (modalMode === "edit") {
        await axios.put(
          `${API_BASE}/payers/${selectedPayer?.payer_id}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        showToast("success", "Payer updated successfully");
      }

      setShowModal(false);
      fetchPayers();
    } catch (error: any) {
      if (error.response?.status === 409) {
        showToast("error", "Payer code already exists");
      } else {
        showToast("error", error.response?.data?.error || "Operation failed");
      }
    }
  };

  const handleDeactivate = async (payerId: string) => {
    if (!confirm("Are you sure you want to deactivate this payer?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/payers/${payerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast("success", "Payer deactivated successfully");
      fetchPayers();
    } catch (error) {
      showToast("error", "Failed to deactivate payer");
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        transmission_method: formData.transmission_method,
        endpoint_url: formData.endpoint_url,
        sftp_config:
          formData.transmission_method === "SFTP" ? sftpConfig : null,
      };

      const response = await axios.post(
        `${API_BASE}/payers/test-connection`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        showToast("success", "Connection test successful!");
      } else {
        showToast("error", "Connection test failed: " + response.data.message);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Connection test failed: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setTestingConnection(false);
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
              onClick={openAddModal}
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
              onClick={openAddModal}
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
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-teal-100 transition-colors"
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
                  {payers.map((payer) => (
                    <tr
                      key={payer.payer_id}
                      className="hover:bg-teal-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <Building2 className="text-teal-600" size={20} />
                          </div>
                          <div className="font-semibold text-gray-900">
                            {payer.payer_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {payer.payer_code}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {payer.payer_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payer.electronic_payer_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payer.trading_partner_id}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {payer.transmission_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payer.city}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payer.state}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openViewModal(payer)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(payer)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {modalMode === "add"
                  ? "Add New Payer"
                  : modalMode === "edit"
                  ? "Edit Payer"
                  : "View Payer"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-gray-50">
              <nav className="flex">
                {[
                  { key: "general", label: "General Info", icon: FileText },
                  { key: "contact", label: "Contact & Address", icon: MapPin },
                  {
                    key: "transmission",
                    label: "Transmission/Integration",
                    icon: Wifi,
                  },
                  { key: "metadata", label: "Metadata & Audit", icon: Clock },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? "border-teal-600 text-teal-600 bg-white"
                          : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <Icon size={18} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* General Info Tab */}
              {activeTab === "general" && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Payer Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.payer_code}
                      onChange={(e) =>
                        setFormData({ ...formData, payer_code: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                        errors.payer_code ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="e.g., BCBS001"
                    />
                    {errors.payer_code && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.payer_code}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Payer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.payer_name}
                      onChange={(e) =>
                        setFormData({ ...formData, payer_name: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                        errors.payer_name ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="e.g., Blue Cross Blue Shield"
                    />
                    {errors.payer_name && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.payer_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Payer Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.payer_type}
                      onChange={(e) =>
                        setFormData({ ...formData, payer_type: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white ${
                        errors.payer_type ? "border-red-500" : "border-gray-300"
                      }`}
                    >
                      <option value="">Select type</option>
                      {payerTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.payer_type && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.payer_type}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Trading Partner ID
                    </label>
                    <input
                      type="text"
                      value={formData.trading_partner_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          trading_partner_id: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="Trading partner identifier"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Electronic Payer ID{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.electronic_payer_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          electronic_payer_id: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                        errors.electronic_payer_id
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="Electronic payer identifier"
                    />
                    {errors.electronic_payer_id && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.electronic_payer_id}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Contact & Address Tab */}
              {activeTab === "contact" && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.address_line1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address_line1: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address_line2: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="Apt, suite, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      State
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
                    >
                      <option value="">Select state</option>
                      {states.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip_code}
                      onChange={(e) =>
                        setFormData({ ...formData, zip_code: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                        errors.zip_code ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="12345 or 12345-6789"
                    />
                    {errors.zip_code && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.zip_code}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="(555) 555-5555"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fax
                    </label>
                    <input
                      type="tel"
                      value={formData.fax}
                      onChange={(e) =>
                        setFormData({ ...formData, fax: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="(555) 555-5555"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                        errors.email ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="email@example.com"
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Transmission/Integration Tab */}
              {activeTab === "transmission" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Transmission Method
                      </label>
                      <select
                        value={formData.transmission_method}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            transmission_method: e.target.value,
                          })
                        }
                        disabled={modalMode === "view"}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
                      >
                        {transmissionMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Endpoint URL
                      </label>
                      <input
                        type="text"
                        value={formData.endpoint_url}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            endpoint_url: e.target.value,
                          })
                        }
                        disabled={modalMode === "view"}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                          errors.endpoint_url
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        placeholder="https://api.payer.com/endpoint"
                      />
                      {errors.endpoint_url && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.endpoint_url}
                        </p>
                      )}
                    </div>
                  </div>

                  {formData.transmission_method === "SFTP" && (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        SFTP Configuration
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Host
                          </label>
                          <input
                            type="text"
                            value={sftpConfig.host}
                            onChange={(e) =>
                              setSftpConfig({
                                ...sftpConfig,
                                host: e.target.value,
                              })
                            }
                            disabled={modalMode === "view"}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                            placeholder="sftp.payer.com"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Port
                          </label>
                          <input
                            type="number"
                            value={sftpConfig.port}
                            onChange={(e) =>
                              setSftpConfig({
                                ...sftpConfig,
                                port: parseInt(e.target.value),
                              })
                            }
                            disabled={modalMode === "view"}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                            placeholder="22"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Username
                          </label>
                          <input
                            type="text"
                            value={sftpConfig.username}
                            onChange={(e) =>
                              setSftpConfig({
                                ...sftpConfig,
                                username: e.target.value,
                              })
                            }
                            disabled={modalMode === "view"}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                            placeholder="Username"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Password
                          </label>
                          <input
                            type="password"
                            value={sftpConfig.password}
                            onChange={(e) =>
                              setSftpConfig({
                                ...sftpConfig,
                                password: e.target.value,
                              })
                            }
                            disabled={modalMode === "view"}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                            placeholder="••••••••"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Remote Path
                          </label>
                          <input
                            type="text"
                            value={sftpConfig.remotePath}
                            onChange={(e) =>
                              setSftpConfig({
                                ...sftpConfig,
                                remotePath: e.target.value,
                              })
                            }
                            disabled={modalMode === "view"}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                            placeholder="/inbox"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {modalMode !== "view" && (
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={testConnection}
                        disabled={testingConnection}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {testingConnection ? (
                          <>
                            <Loader className="animate-spin" size={18} />
                            Testing Connection...
                          </>
                        ) : (
                          <>
                            <Wifi size={18} />
                            Test Connection
                          </>
                        )}
                      </button>
                      <p className="text-sm text-gray-600">
                        Verify transmission settings are correct
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata & Audit Tab */}
              {activeTab === "metadata" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              is_active: e.target.checked,
                            })
                          }
                          disabled={modalMode === "view"}
                          className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          Active
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={modalMode === "view"}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                      placeholder="Add internal notes about this payer..."
                    />
                  </div>

                  {modalMode !== "add" && selectedPayer && (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Audit Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">
                            Created At:
                          </span>
                          <p className="text-gray-600 mt-1">
                            {new Date(
                              selectedPayer.created_at
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Last Updated:
                          </span>
                          <p className="text-gray-600 mt-1">
                            {new Date(
                              selectedPayer.updated_at
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {modalMode !== "view" && (
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-cyan-800 transition-all shadow-md"
                >
                  {modalMode === "add" ? "Add Payer" : "Update Payer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PayerMaster;
