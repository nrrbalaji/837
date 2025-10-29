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
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Users,
  FileText,
  MapPin,
  CreditCard,
  Clock,
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

interface Facility {
  facility_id: string;
  facility_name: string;
  facility_code: string;
}

const ProviderProfileMaster: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<
    "general" | "address" | "payers" | "notes"
  >("general");
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

  // Form states
  const [formData, setFormData] = useState<
    Partial<Provider & { facility_id?: string }>
  >({
    provider_name: "",
    npi: "",
    tax_id: "",
    facility_type: "",
    facility_id: "",
    taxonomy_code: "",
    status: "Active",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

  const [payerMappings, setPayerMappings] = useState<PayerMapping[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProviders();
    fetchFacilities();
  }, [currentPage, sortField, sortOrder, filters]);

  const fetchFacilities = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/facilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFacilities(response.data || []);
    } catch (error) {
      console.error("Error fetching facilities:", error);
    }
  };

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

  const openAddModal = () => {
    setModalMode("add");
    setFormData({
      provider_name: "",
      npi: "",
      tax_id: "",
      facility_type: facilityTypes[0],
      facility_id: "",
      taxonomy_code: "",
      status: "Active",
      address: "",
      city: "",
      state: "",
      zip: "",
      country: "USA",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
    });
    setPayerMappings([]);
    setNotes("");
    setErrors({});
    setActiveTab("general");
    setShowModal(true);
  };

  const openEditModal = (provider: Provider) => {
    setModalMode("edit");
    setSelectedProvider(provider);
    setFormData(provider);
    setPayerMappings(provider.payer_mappings || []);
    setActiveTab("general");
    setShowModal(true);
  };

  const openViewModal = (provider: Provider) => {
    setModalMode("view");
    setSelectedProvider(provider);
    setFormData(provider);
    setPayerMappings(provider.payer_mappings || []);
    setActiveTab("general");
    setShowModal(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.provider_name?.trim())
      newErrors.provider_name = "Provider name is required";
    if (!formData.npi?.trim()) newErrors.npi = "NPI is required";
    else if (!/^\d{10}$/.test(formData.npi))
      newErrors.npi = "NPI must be 10 digits";
    if (!formData.tax_id?.trim()) newErrors.tax_id = "Tax ID is required";
    if (!formData.facility_type)
      newErrors.facility_type = "Facility type is required";
    if (!formData.taxonomy_code?.trim())
      newErrors.taxonomy_code = "Taxonomy code is required";
    if (
      formData.contact_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)
    ) {
      newErrors.contact_email = "Invalid email format";
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
        payer_mappings: payerMappings,
        notes,
      };

      if (modalMode === "add") {
        await axios.post(`${API_BASE}/providers`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Provider added successfully");
      } else if (modalMode === "edit") {
        await axios.put(
          `${API_BASE}/providers/${selectedProvider?.provider_id}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        showToast("success", "Provider updated successfully");
      }

      setShowModal(false);
      fetchProviders();
    } catch (error: any) {
      showToast("error", error.response?.data?.error || "Operation failed");
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

  const addPayerMapping = () => {
    setPayerMappings([
      ...payerMappings,
      {
        payer_name: "",
        payer_id: "",
        enrollment_status: "Active",
        effective_date: new Date().toISOString().split("T")[0],
      },
    ]);
  };

  const removePayerMapping = (index: number) => {
    setPayerMappings(payerMappings.filter((_, i) => i !== index));
  };

  const updatePayerMapping = (
    index: number,
    field: keyof PayerMapping,
    value: string
  ) => {
    const updated = [...payerMappings];
    updated[index] = { ...updated[index], [field]: value };
    setPayerMappings(updated);
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
              onClick={openAddModal}
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
              onClick={openAddModal}
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
                            onClick={() => openViewModal(provider)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(provider)}
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

      {/* Modal (continued in next part due to length) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {modalMode === "add"
                  ? "Add New Provider"
                  : modalMode === "edit"
                  ? "Edit Provider"
                  : "View Provider"}
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
                  { key: "address", label: "Address Info", icon: MapPin },
                  { key: "payers", label: "Payer Mappings", icon: CreditCard },
                  { key: "notes", label: "Notes & Audit", icon: Clock },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.key
                          ? "border-blue-600 text-blue-600 bg-white"
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
                      Provider Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.provider_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          provider_name: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.provider_name
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="Enter provider name"
                    />
                    {errors.provider_name && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.provider_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      NPI <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.npi}
                      onChange={(e) =>
                        setFormData({ ...formData, npi: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.npi ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="10-digit NPI"
                      maxLength={10}
                    />
                    {errors.npi && (
                      <p className="text-red-500 text-xs mt-1">{errors.npi}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tax ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.tax_id}
                      onChange={(e) =>
                        setFormData({ ...formData, tax_id: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.tax_id ? "border-red-500" : "border-gray-300"
                      }`}
                      placeholder="Enter Tax ID"
                    />
                    {errors.tax_id && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.tax_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Specialty <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.facility_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facility_type: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white ${
                        errors.facility_type
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select specialty</option>
                      {facilityTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.facility_type && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.facility_type}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Facility
                    </label>
                    <select
                      value={formData.facility_id || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facility_id: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      <option value="">Select facility</option>
                      {facilities.map((facility) => (
                        <option
                          key={facility.facility_id}
                          value={facility.facility_id}
                        >
                          {facility.facility_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Taxonomy Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.taxonomy_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          taxonomy_code: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.taxonomy_code
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="Enter taxonomy code"
                    />
                    {errors.taxonomy_code && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.taxonomy_code}
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Address Info Tab */}
              {activeTab === "address" && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Street address"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="State"
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) =>
                        setFormData({ ...formData, zip: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="ZIP code"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Country"
                    />
                  </div>

                  <div className="col-span-2 border-t border-gray-200 pt-6 mt-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Contact Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_name: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Contact person name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_email: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.contact_email
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="email@example.com"
                    />
                    {errors.contact_email && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.contact_email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_phone: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="(555) 555-5555"
                    />
                  </div>
                </div>
              )}

              {/* Payer Mappings Tab */}
              {activeTab === "payers" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Payer Mappings
                    </h3>
                    {modalMode !== "view" && (
                      <button
                        onClick={addPayerMapping}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all"
                      >
                        <Plus size={16} />
                        Add Payer
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {payerMappings.map((mapping, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Payer Name
                            </label>
                            <input
                              type="text"
                              value={mapping.payer_name}
                              onChange={(e) =>
                                updatePayerMapping(
                                  index,
                                  "payer_name",
                                  e.target.value
                                )
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                              placeholder="Payer name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Payer ID
                            </label>
                            <input
                              type="text"
                              value={mapping.payer_id}
                              onChange={(e) =>
                                updatePayerMapping(
                                  index,
                                  "payer_id",
                                  e.target.value
                                )
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                              placeholder="Payer ID"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Enrollment Status
                            </label>
                            <select
                              value={mapping.enrollment_status}
                              onChange={(e) =>
                                updatePayerMapping(
                                  index,
                                  "enrollment_status",
                                  e.target.value
                                )
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="Active">Active</option>
                              <option value="Pending">Pending</option>
                              <option value="Inactive">Inactive</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Effective Date
                            </label>
                            <input
                              type="date"
                              value={mapping.effective_date}
                              onChange={(e) =>
                                updatePayerMapping(
                                  index,
                                  "effective_date",
                                  e.target.value
                                )
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Termination Date
                            </label>
                            <input
                              type="date"
                              value={mapping.termination_date || ""}
                              onChange={(e) =>
                                updatePayerMapping(
                                  index,
                                  "termination_date",
                                  e.target.value
                                )
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          {modalMode !== "view" && (
                            <div className="flex items-end">
                              <button
                                onClick={() => removePayerMapping(index)}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {payerMappings.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <CreditCard
                          className="mx-auto mb-3 text-gray-400"
                          size={40}
                        />
                        <p>No payer mappings added yet</p>
                      </div>
                    )}
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
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={modalMode === "view"}
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Add notes about this provider..."
                    />
                  </div>

                  {modalMode !== "add" && selectedProvider && (
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
                              selectedProvider.created_at
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Last Updated:
                          </span>
                          <p className="text-gray-600 mt-1">
                            {new Date(
                              selectedProvider.updated_at
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
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
                >
                  {modalMode === "add" ? "Add Provider" : "Update Provider"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfileMaster;
