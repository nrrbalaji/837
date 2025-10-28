import React, { useState, useEffect } from "react";
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
  FileText,
  MapPin,
  Settings,
  Clock,
  Link as LinkIcon,
  FolderInput,
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

interface Payer {
  payer_id: string;
  payer_name: string;
  payer_code: string;
}

const FacilityMaster: React.FC = () => {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLinkPayerModal, setShowLinkPayerModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "view">("add");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<
    "general" | "address" | "operational" | "ingestion" | "audit"
  >("general");
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

  // Form states
  const [formData, setFormData] = useState<Partial<Facility>>({
    facility_code: "",
    facility_name: "",
    facility_type: "",
    npi: "",
    tax_id: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    phone: "",
    fax: "",
    email: "",
    is_active: true,
  });

  const [linkedPayers, setLinkedPayers] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [defaultBillingLocation, setDefaultBillingLocation] = useState(false);

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
    fetchFacilities();
    fetchPayers();
  }, [currentPage, sortField, sortOrder, filters]);

  const fetchPayers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/payers?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPayers(response.data.payers || []);
    } catch (error) {
      console.error("Error fetching payers:", error);
    }
  };

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

  const openAddModal = () => {
    setModalMode("add");
    setFormData({
      facility_code: "",
      facility_name: "",
      facility_type: facilityTypes[0],
      npi: "",
      tax_id: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      fax: "",
      email: "",
      is_active: true,
    });
    setLinkedPayers([]);
    setContactPerson("");
    setDefaultBillingLocation(false);
    setNotes("");
    setErrors({});
    setActiveTab("general");
    setShowModal(true);
  };

  const openEditModal = (facility: Facility) => {
    setModalMode("edit");
    setSelectedFacility(facility);

    // Parse ingestion_config if it exists and is a string
    let parsedConfig = facility.ingestion_config;
    if (typeof parsedConfig === "string") {
      try {
        parsedConfig = JSON.parse(parsedConfig);
      } catch (e) {
        console.error("Error parsing ingestion_config:", e);
        parsedConfig = null;
      }
    }

    // Extract SFTP or LOCAL configuration from ingestion_config
    let sftp_config = undefined;
    let local_config = undefined;

    if (parsedConfig) {
      if (parsedConfig.mode === "SFTP" && parsedConfig.sftp) {
        sftp_config = parsedConfig.sftp;
      } else if (parsedConfig.mode === "LOCAL_FOLDER" && parsedConfig.local) {
        local_config = parsedConfig.local;
      }
    }

    setFormData({
      ...facility,
      ingestion_config: parsedConfig,
      sftp_config,
      local_config,
    });
    setActiveTab("general");
    setShowModal(true);
  };

  const openViewModal = (facility: Facility) => {
    setModalMode("view");
    setSelectedFacility(facility);

    // Parse ingestion_config if it exists and is a string
    let parsedConfig = facility.ingestion_config;
    if (typeof parsedConfig === "string") {
      try {
        parsedConfig = JSON.parse(parsedConfig);
      } catch (e) {
        console.error("Error parsing ingestion_config:", e);
        parsedConfig = null;
      }
    }

    // Extract SFTP or LOCAL configuration from ingestion_config
    let sftp_config = undefined;
    let local_config = undefined;

    if (parsedConfig) {
      if (parsedConfig.mode === "SFTP" && parsedConfig.sftp) {
        sftp_config = parsedConfig.sftp;
      } else if (parsedConfig.mode === "LOCAL_FOLDER" && parsedConfig.local) {
        local_config = parsedConfig.local;
      }
    }

    setFormData({
      ...facility,
      ingestion_config: parsedConfig,
      sftp_config,
      local_config,
    });
    setActiveTab("general");
    setShowModal(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.facility_code?.trim())
      newErrors.facility_code = "Facility code is required";
    if (!formData.facility_name?.trim())
      newErrors.facility_name = "Facility name is required";
    if (!formData.facility_type)
      newErrors.facility_type = "Facility type is required";

    if (!formData.npi?.trim()) {
      newErrors.npi = "NPI is required";
    } else if (!/^\d{10}$/.test(formData.npi)) {
      newErrors.npi = "NPI must be exactly 10 digits";
    }

    if (!formData.tax_id?.trim()) newErrors.tax_id = "Tax ID is required";

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (formData.zip_code && !/^\d{5}(-\d{4})?$/.test(formData.zip_code)) {
      newErrors.zip_code = "Invalid ZIP code format";
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

      // Construct ingestion_config based on ingestion_mode
      let ingestion_config = {};
      if (formData.ingestion_mode === "SFTP" && formData.sftp_config) {
        ingestion_config = {
          mode: "SFTP",
          sftp: {
            enabled: formData.sftp_config.enabled || true,
            host: formData.sftp_config.host,
            port: formData.sftp_config.port,
            username: formData.sftp_config.username,
            auth_method: formData.sftp_config.auth_method,
            password_encrypted: formData.sftp_config.password, // Backend will encrypt
            private_key_path: formData.sftp_config.private_key_path,
            input_folder: formData.sftp_config.input_folder,
            output_folder: formData.sftp_config.output_folder,
            archive_folder: formData.sftp_config.archive_folder || null,
            poll_interval_seconds:
              formData.sftp_config.poll_interval_seconds || 300,
            connection_timeout_seconds: 30,
            max_retries: 3,
          },
        };
      } else if (
        formData.ingestion_mode === "LOCAL_FOLDER" &&
        formData.local_config
      ) {
        ingestion_config = {
          mode: "LOCAL_FOLDER",
          local: {
            enabled: formData.local_config.enabled || true,
            input_folder: formData.local_config.input_folder,
            output_folder: formData.local_config.output_folder,
            archive_folder: formData.local_config.archive_folder || null,
            watch_recursive: formData.local_config.watch_recursive || false,
            debounce_milliseconds:
              formData.local_config.debounce_milliseconds || 2000,
          },
        };
      }

      const payload = {
        ...formData,
        ingestion_config,
        contact_person: contactPerson,
        default_billing_location: defaultBillingLocation,
        linked_payers: linkedPayers,
        notes,
      };

      // Remove separate config objects from payload
      delete payload.sftp_config;
      delete payload.local_config;

      if (modalMode === "add") {
        await axios.post(`${API_BASE}/facilities`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Facility added successfully");
        showToast("info", "Relink job scheduled for background processing");
      } else if (modalMode === "edit") {
        await axios.put(
          `${API_BASE}/facilities/${selectedFacility?.facility_id}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        showToast("success", "Facility updated successfully");
        if (formData.npi || formData.tax_id) {
          showToast("info", "Relink job scheduled for background processing");
        }
      }

      setShowModal(false);
      fetchFacilities();
    } catch (error: any) {
      if (error.response?.status === 409) {
        showToast("error", "Facility code already exists");
      } else {
        showToast("error", error.response?.data?.error || "Operation failed");
      }
    }
  };

  const handleDeactivate = async (facilityId: string) => {
    if (!confirm("Are you sure you want to deactivate this facility?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/facilities/${facilityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast("success", "Facility deactivated successfully");
      fetchFacilities();
    } catch (error) {
      showToast("error", "Failed to deactivate facility");
    }
  };

  const togglePayerLink = (payerId: string) => {
    setLinkedPayers((prev) =>
      prev.includes(payerId)
        ? prev.filter((id) => id !== payerId)
        : [...prev, payerId]
    );
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
              onClick={openAddModal}
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
              onClick={openAddModal}
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
                            onClick={() => openViewModal(facility)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openEditModal(facility)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {modalMode === "add"
                  ? "Add New Facility"
                  : modalMode === "edit"
                  ? "Edit Facility"
                  : "View Facility"}
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
              <nav className="flex overflow-x-auto">
                {[
                  { key: "general", label: "General Info", icon: FileText },
                  { key: "address", label: "Address & Contact", icon: MapPin },
                  { key: "operational", label: "Operational", icon: Settings },
                  {
                    key: "ingestion",
                    label: "File Ingestion",
                    icon: FolderInput,
                  },
                  { key: "audit", label: "Audit", icon: Clock },
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
                      Facility Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.facility_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facility_code: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.facility_code
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="e.g., FAC001"
                    />
                    {errors.facility_code && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.facility_code}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Facility Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.facility_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          facility_name: e.target.value,
                        })
                      }
                      disabled={modalMode === "view"}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                        errors.facility_name
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      placeholder="e.g., St. Mary's Hospital"
                    />
                    {errors.facility_name && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.facility_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Facility Type <span className="text-red-500">*</span>
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
                      <option value="">Select type</option>
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

                  <div className="col-span-2">
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
                </div>
              )}

              {/* Address & Contact Tab */}
              {activeTab === "address" && (
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Suite, floor, etc."
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
                    <select
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                      className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      disabled={modalMode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Primary contact name"
                    />
                  </div>
                </div>
              )}

              {/* Operational Tab */}
              {activeTab === "operational" && (
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
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          Active
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={defaultBillingLocation}
                          onChange={(e) =>
                            setDefaultBillingLocation(e.target.checked)
                          }
                          disabled={modalMode === "view"}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          Default Billing Location
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Linked Payers
                      </h3>
                      {modalMode !== "view" && (
                        <button
                          onClick={() => setShowLinkPayerModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all"
                        >
                          <LinkIcon size={16} />
                          Link Payer
                        </button>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      {payers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          No payers available
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {payers.map((payer) => (
                            <label
                              key={payer.payer_id}
                              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={linkedPayers.includes(payer.payer_id)}
                                onChange={() => togglePayerLink(payer.payer_id)}
                                disabled={modalMode === "view"}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {payer.payer_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {payer.payer_code}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* File Ingestion Tab - Enhanced Inline Component */}
              {activeTab === "ingestion" && (
                <div className="space-y-6">
                  {/* File Ingestion Configuration */}
                  <div className="space-y-8">
                    {/* Ingestion Mode Selection */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        File Ingestion Mode *
                      </label>
                      <div className="space-y-4">
                        {[
                          {
                            value: "REST_API",
                            label: "REST API Upload",
                            description:
                              "Files uploaded through web interface or API",
                          },
                          {
                            value: "SFTP",
                            label: "SFTP Server",
                            description:
                              "Automated file pickup from SFTP server",
                          },
                          {
                            value: "LOCAL_FOLDER",
                            label: "Local File System",
                            description: "Watch local folder for new files",
                          },
                        ].map((mode) => (
                          <div
                            key={mode.value}
                            className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <input
                              type="radio"
                              name="ingestionMode"
                              value={mode.value}
                              checked={formData.ingestion_mode === mode.value}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  ingestion_mode: e.target.value as
                                    | "REST_API"
                                    | "SFTP"
                                    | "LOCAL_FOLDER",
                                })
                              }
                              disabled={modalMode === "view"}
                              className="mt-1 text-blue-600"
                            />
                            <div className="flex-1">
                              <label className="font-medium text-gray-900 text-base">
                                {mode.label}
                              </label>
                              <p className="text-sm text-gray-600 mt-1">
                                {mode.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Format Selection */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Data Format *
                      </label>
                      <div className="space-y-4">
                        {[
                          {
                            value: "FHIR",
                            label:
                              "FHIR (Fast Healthcare Interoperability Resources)",
                            description:
                              "Modern API-based healthcare data standard",
                          },
                          {
                            value: "HL7",
                            label: "HL7 (Health Level Seven)",
                            description:
                              "Traditional healthcare messaging standard",
                          },
                        ].map((format) => (
                          <div
                            key={format.value}
                            className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <input
                              type="radio"
                              name="dataFormat"
                              value={format.value}
                              checked={formData.data_format === format.value}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  data_format: e.target.value as "FHIR" | "HL7",
                                })
                              }
                              disabled={modalMode === "view"}
                              className="mt-1 text-blue-600"
                            />
                            <div className="flex-1">
                              <label className="font-medium text-gray-900 text-base">
                                {format.label}
                              </label>
                              <p className="text-sm text-gray-600 mt-1">
                                {format.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SFTP Configuration - Only show if SFTP selected */}
                    {formData.ingestion_mode === "SFTP" && (
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">
                          SFTP Configuration
                        </h3>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              SFTP Host *
                            </label>
                            <input
                              type="text"
                              value={formData.sftp_config?.host || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    host: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="ftp.clearinghouse.com"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Port *
                            </label>
                            <input
                              type="number"
                              value={formData.sftp_config?.port || 22}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    port: parseInt(e.target.value),
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="22"
                              min="1"
                              max="65535"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Username *
                            </label>
                            <input
                              type="text"
                              value={formData.sftp_config?.username || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    username: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="facility_user"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Authentication Method
                            </label>
                            <select
                              value={
                                formData.sftp_config?.auth_method || "password"
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    auth_method: e.target.value as
                                      | "password"
                                      | "ssh_key",
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                              <option value="password">Password</option>
                              <option value="ssh_key">SSH Key</option>
                            </select>
                          </div>

                          {formData.sftp_config?.auth_method === "password" && (
                            <div className="col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password *
                              </label>
                              <input
                                type="password"
                                value={formData.sftp_config?.password || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    sftp_config: {
                                      ...formData.sftp_config,
                                      password: e.target.value,
                                      enabled: true,
                                    },
                                  })
                                }
                                disabled={modalMode === "view"}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                placeholder="Enter SFTP password"
                              />
                            </div>
                          )}

                          {formData.sftp_config?.auth_method === "ssh_key" && (
                            <div className="col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                SSH Private Key Path *
                              </label>
                              <input
                                type="text"
                                value={
                                  formData.sftp_config?.private_key_path || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    sftp_config: {
                                      ...formData.sftp_config,
                                      private_key_path: e.target.value,
                                      enabled: true,
                                    },
                                  })
                                }
                                disabled={modalMode === "view"}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                placeholder="/keys/facility_001.pem"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Input Folder *
                            </label>
                            <input
                              type="text"
                              value={
                                formData.sftp_config?.input_folder ||
                                "/inbound/837"
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    input_folder: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="/inbound/837"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Output Folder *
                            </label>
                            <input
                              type="text"
                              value={
                                formData.sftp_config?.output_folder ||
                                "/outbound/837"
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    output_folder: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="/outbound/837"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Archive Folder (Optional)
                            </label>
                            <input
                              type="text"
                              value={formData.sftp_config?.archive_folder || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    archive_folder: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="/archive"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Poll Interval (seconds)
                            </label>
                            <input
                              type="number"
                              value={
                                formData.sftp_config?.poll_interval_seconds ||
                                300
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sftp_config: {
                                    ...formData.sftp_config,
                                    poll_interval_seconds: parseInt(
                                      e.target.value
                                    ),
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="300"
                              min="60"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Local Folder Configuration - Only show if Local Folder selected */}
                    {formData.ingestion_mode === "LOCAL_FOLDER" && (
                      <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-6">
                          Local Folder Configuration
                        </h3>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Input Folder *
                            </label>
                            <input
                              type="text"
                              value={formData.local_config?.input_folder || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  local_config: {
                                    ...formData.local_config,
                                    input_folder: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="/data/837/input"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Output Folder *
                            </label>
                            <input
                              type="text"
                              value={formData.local_config?.output_folder || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  local_config: {
                                    ...formData.local_config,
                                    output_folder: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="/data/837/output"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Archive Folder (Optional)
                            </label>
                            <input
                              type="text"
                              value={
                                formData.local_config?.archive_folder || ""
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  local_config: {
                                    ...formData.local_config,
                                    archive_folder: e.target.value,
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="/data/837/archive"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Debounce (milliseconds)
                            </label>
                            <input
                              type="number"
                              value={
                                formData.local_config?.debounce_milliseconds ||
                                2000
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  local_config: {
                                    ...formData.local_config,
                                    debounce_milliseconds: parseInt(
                                      e.target.value
                                    ),
                                    enabled: true,
                                  },
                                })
                              }
                              disabled={modalMode === "view"}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="2000"
                              min="500"
                              max="10000"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={
                                  formData.local_config?.watch_recursive ||
                                  false
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    local_config: {
                                      ...formData.local_config,
                                      watch_recursive: e.target.checked,
                                      enabled: true,
                                    },
                                  })
                                }
                                disabled={modalMode === "view"}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Monitor subdirectories
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === "audit" && (
                <div className="space-y-6">
                  {modalMode !== "add" && selectedFacility && (
                    <div>
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
                              selectedFacility.created_at
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Last Updated:
                          </span>
                          <p className="text-gray-600 mt-1">
                            {new Date(
                              selectedFacility.updated_at
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={modalMode === "view"}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Add internal notes about this facility..."
                    />
                  </div>
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
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md"
                >
                  {modalMode === "add" ? "Add Facility" : "Update Facility"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityMaster;
