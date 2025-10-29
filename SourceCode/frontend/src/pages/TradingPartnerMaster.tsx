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
  Network,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Globe,
  FileText,
  MapPin,
  Settings,
  Clock,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface TradingPartner {
  trading_partner_id: string;
  partner_name: string;
  partner_type: "Sender" | "Receiver" | "Both";
  sender_qualifier: string;
  sender_id: string;
  receiver_qualifier: string;
  receiver_id: string;
  direction: "Inbound" | "Outbound" | "Bidirectional";
  default_payer_id?: string;
  default_payer_name?: string;
  channel_type: "SFTP" | "API" | "HL7" | "FHIR";
  endpoint_url: string;
  sftp_config?: any;
  api_config?: any;
  edi_version: string;
  test_mode: boolean;
  status: "Active" | "Inactive" | "Testing";
  effective_from: string;
  effective_to: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TradingPartnerMaster: React.FC = () => {
  const [tradingPartners, setTradingPartners] = useState<TradingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [selectedPartner, setSelectedPartner] = useState<TradingPartner | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<
    "general" | "connection" | "edi" | "notes"
  >("general");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>("partner_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    partnerName: "",
    partnerType: "",
    direction: "",
    channelType: "",
    status: "",
  });

  // Form states
  const [formData, setFormData] = useState<Partial<TradingPartner>>({
    trading_partner_id: "",
    partner_name: "",
    partner_type: "Sender",
    sender_qualifier: "",
    sender_id: "",
    receiver_qualifier: "",
    receiver_id: "",
    direction: "Inbound",
    channel_type: "SFTP",
    endpoint_url: "",
    edi_version: "5010",
    test_mode: false,
    status: "Active",
    effective_from: new Date().toISOString().split("T")[0],
    effective_to: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTradingPartners();
  }, [currentPage, sortField, sortOrder, filters]);

  const fetchTradingPartners = async () => {
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

      const response = await axios.get(
        `${API_BASE}/trading-partners?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setTradingPartners(response.data.tradingPartners || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching trading partners:", error);
      showToast("error", "Failed to fetch trading partners");
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

  const openAddModal = () => {
    setModalMode("add");
    setFormData({
      trading_partner_id: "",
      partner_name: "",
      partner_type: "Sender",
      sender_qualifier: "",
      sender_id: "",
      receiver_qualifier: "",
      receiver_id: "",
      direction: "Inbound",
      channel_type: "SFTP",
      endpoint_url: "",
      edi_version: "5010",
      test_mode: false,
      status: "Active",
      effective_from: new Date().toISOString().split("T")[0],
      effective_to: "",
      notes: "",
    });
    setErrors({});
    setActiveTab("general");
    setShowModal(true);
  };

  const openEditModal = (partner: TradingPartner) => {
    setModalMode("edit");
    setSelectedPartner(partner);
    setFormData(partner);
    setActiveTab("general");
    setShowModal(true);
  };

  const openViewModal = (partner: TradingPartner) => {
    setModalMode("view");
    setSelectedPartner(partner);
    setFormData(partner);
    setActiveTab("general");
    setShowModal(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.trading_partner_id?.trim())
      newErrors.trading_partner_id = "Trading Partner ID is required";
    if (!formData.partner_name?.trim())
      newErrors.partner_name = "Partner name is required";
    if (!formData.sender_id?.trim())
      newErrors.sender_id = "Sender ID is required";
    if (!formData.receiver_id?.trim())
      newErrors.receiver_id = "Receiver ID is required";
    if (!formData.endpoint_url?.trim())
      newErrors.endpoint_url = "Endpoint URL is required";

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
      const payload = formData;

      if (modalMode === "add") {
        await axios.post(`${API_BASE}/trading-partners`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Trading partner added successfully");
      } else if (modalMode === "edit") {
        await axios.put(
          `${API_BASE}/trading-partners/${selectedPartner?.trading_partner_id}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        showToast("success", "Trading partner updated successfully");
      }

      setShowModal(false);
      fetchTradingPartners();
    } catch (error: any) {
      showToast("error", error.response?.data?.error || "Operation failed");
    }
  };

  const handleDelete = async (partnerId: string) => {
    if (!confirm("Are you sure you want to delete this trading partner?"))
      return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/trading-partners/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast("success", "Trading partner deleted successfully");
      fetchTradingPartners();
    } catch (error) {
      showToast("error", "Failed to delete trading partner");
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/trading-partners/export/csv`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `trading_partners_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

      showToast("success", "Trading partners exported successfully");
    } catch (error) {
      showToast("error", "Failed to export trading partners");
    }
  };

  const partnerTypes = ["Sender", "Receiver", "Both"];
  const directions = ["Inbound", "Outbound", "Bidirectional"];
  const channelTypes = ["SFTP", "API", "HL7", "FHIR"];
  const statuses = ["Active", "Inactive", "Testing"];

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
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Network className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Trading Partner Master
              </h1>
              <p className="text-gray-600 mt-1">
                Manage EDI trading partner configurations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                alert("Import feature - see CSV_INTEGRATION_GUIDE.md")
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-purple-400 transition-all shadow-sm"
            >
              <Upload size={18} />
              Import
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-purple-400 transition-all shadow-sm"
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={fetchTradingPartners}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-purple-300 text-purple-700 font-medium rounded-lg hover:bg-purple-50 hover:border-purple-500 transition-all shadow-sm"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={20} />
              Add Trading Partner
            </button>
          </div>
        </div>

        {/* Search/Filter Panel */}
        <div className="card shadow-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="text-purple-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">
              Search & Filter
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Partner Name
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={filters.partnerName}
                  onChange={(e) =>
                    setFilters({ ...filters, partnerName: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Partner Type
              </label>
              <select
                value={filters.partnerType}
                onChange={(e) =>
                  setFilters({ ...filters, partnerType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
              >
                <option value="">All Types</option>
                {partnerTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Direction
              </label>
              <select
                value={filters.direction}
                onChange={(e) =>
                  setFilters({ ...filters, direction: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
              >
                <option value="">All Directions</option>
                {directions.map((dir) => (
                  <option key={dir} value={dir}>
                    {dir}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel
              </label>
              <select
                value={filters.channelType}
                onChange={(e) =>
                  setFilters({ ...filters, channelType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
              >
                <option value="">All Channels</option>
                {channelTypes.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
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

      {/* Trading Partners Table */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading trading partners...
            </p>
          </div>
        ) : tradingPartners.length === 0 ? (
          <div className="p-12 text-center">
            <Network className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-700 font-medium mb-2">
              No trading partners found
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Get started by adding your first trading partner
            </p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-all"
            >
              <Plus size={18} />
              Add Trading Partner
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-purple-50 to-indigo-50">
                  <tr>
                    {[
                      { field: "trading_partner_id", label: "ID" },
                      { field: "partner_name", label: "Partner Name" },
                      { field: "partner_type", label: "Type" },
                      { field: "direction", label: "Direction" },
                      { field: "channel_type", label: "Channel" },
                      { field: "status", label: "Status" },
                    ].map((col) => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-100 transition-colors"
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
                  {tradingPartners.map((partner) => (
                    <tr
                      key={partner.trading_partner_id}
                      className="hover:bg-purple-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {partner.trading_partner_id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Network className="text-purple-600" size={20} />
                          </div>
                          <div className="font-semibold text-gray-900">
                            {partner.partner_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {partner.partner_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {partner.direction}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {partner.channel_type}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            partner.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : partner.status === "Inactive"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {partner.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openViewModal(partner)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(partner)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(partner.trading_partner_id)
                            }
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {modalMode === "add"
                  ? "Add New Trading Partner"
                  : modalMode === "edit"
                  ? "Edit Trading Partner"
                  : "View Trading Partner"}
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
                  { key: "connection", label: "Connection", icon: Globe },
                  { key: "edi", label: "EDI Config", icon: Settings },
                  { key: "notes", label: "Notes & Audit", icon: Clock },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? "border-purple-600 text-purple-600 bg-white"
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
                      Trading Partner ID <span className="text-red-500">*</span>
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
                      disabled={modalMode !== "add"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 ${
                        errors.trading_partner_id
                          ? "border-red-500"
                          : "border-gray-300"
                      } ${modalMode !== "add" ? "bg-gray-100" : ""}`}
                      placeholder="e.g., TP0001"
                    />
                    {errors.trading_partner_id && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.trading_partner_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Partner Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.partner_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          partner_name: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 ${
                        errors.partner_name
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="Partner organization name"
                    />
                    {errors.partner_name && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.partner_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Partner Type
                    </label>
                    <select
                      value={formData.partner_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          partner_type: e.target.value as any,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    >
                      {partnerTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Direction
                    </label>
                    <select
                      value={formData.direction}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          direction: e.target.value as any,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    >
                      {directions.map((dir) => (
                        <option key={dir} value={dir}>
                          {dir}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sender Qualifier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.sender_qualifier}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sender_qualifier: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                      placeholder="e.g., ZZ, 30"
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sender ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.sender_id}
                      onChange={(e) =>
                        setFormData({ ...formData, sender_id: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 ${
                        errors.sender_id ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="Sender identifier"
                    />
                    {errors.sender_id && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.sender_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Receiver Qualifier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.receiver_qualifier}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          receiver_qualifier: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                      placeholder="e.g., ZZ, 30"
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Receiver ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.receiver_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          receiver_id: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 ${
                        errors.receiver_id
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="Receiver identifier"
                    />
                    {errors.receiver_id && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.receiver_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as any,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <input
                        type="checkbox"
                        checked={formData.test_mode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            test_mode: e.target.checked,
                          })
                        }
                        disabled={modalMode === "view"}
                        className="mr-2"
                      />
                      Test Mode
                    </label>
                  </div>
                </div>
              )}

              {/* Connection Tab */}
              {activeTab === "connection" && (
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Channel Type
                    </label>
                    <select
                      value={formData.channel_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          channel_type: e.target.value as any,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    >
                      {channelTypes.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Endpoint URL <span className="text-red-500">*</span>
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
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 ${
                        errors.endpoint_url
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="https://api.example.com or sftp://server.com/path"
                    />
                    {errors.endpoint_url && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.endpoint_url}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* EDI Config Tab */}
              {activeTab === "edi" && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      EDI Version
                    </label>
                    <input
                      type="text"
                      value={formData.edi_version}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          edi_version: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                      placeholder="5010"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Effective From
                    </label>
                    <input
                      type="date"
                      value={formData.effective_from}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          effective_from: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Effective To
                    </label>
                    <input
                      type="date"
                      value={formData.effective_to}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          effective_to: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    />
                  </div>
                </div>
              )}

              {/* Notes & Audit Tab */}
              {activeTab === "notes" && (
                <div>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                      placeholder="Add notes about this trading partner..."
                    />
                  </div>

                  {modalMode !== "add" && selectedPartner && (
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
                              selectedPartner.created_at
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Last Updated:
                          </span>
                          <p className="text-gray-600 mt-1">
                            {new Date(
                              selectedPartner.updated_at
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
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md"
                >
                  {modalMode === "add"
                    ? "Add Trading Partner"
                    : "Update Trading Partner"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingPartnerMaster;
