import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Loader,
  X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

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

const AddEditFacility: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "address" | "operational" | "ingestion" | "notes"
  >("general");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    ingestion_mode: "REST_API",
    data_format: "HL7",
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
    if (isEditMode && id) {
      fetchFacility(id);
    }
  }, [id, isEditMode]);

  const fetchFacility = async (facilityId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/facilities/${facilityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const facility = response.data;

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
      setLinkedPayers(facility.linked_payers || []);
      setContactPerson(facility.contact_person || "");
      setDefaultBillingLocation(facility.default_billing_location || false);
      setNotes(facility.notes || "");
    } catch (error) {
      console.error("Error fetching facility:", error);
      showToast("error", "Failed to load facility data");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
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

    setSaving(true);
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

      if (isEditMode && id) {
        await axios.put(`${API_BASE}/facilities/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Facility updated successfully");
        if (formData.npi || formData.tax_id) {
        showToast("success", "Relink job scheduled for background processing");
        }
      } else {
        await axios.post(`${API_BASE}/facilities`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Facility added successfully");
      }

      navigate("/facilities");
    } catch (error: any) {
      if (error.response?.status === 409) {
        showToast("error", "Facility code already exists");
      } else {
        showToast("error", error.response?.data?.error || "Operation failed");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading facility data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
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
              <CheckCircle size={20} />
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
          <button
            onClick={() => navigate("/facilities")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Facilities
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? "Edit Facility" : "Add New Facility"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isEditMode
              ? "Update facility information and settings"
              : "Create a new facility profile with all required details"}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex overflow-x-auto">
              {[
                { key: "general", label: "General Info", icon: "📋" },
                { key: "address", label: "Address & Contact", icon: "📍" },
                { key: "operational", label: "Operational", icon: "⚙️" },
                { key: "ingestion", label: "File Ingestion", icon: "📁" },
                { key: "notes", label: "Notes & Audit", icon: "📝" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-600 bg-white"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Form Content */}
          <div className="p-6">
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
                    <p className="text-sm text-gray-600">
                      Select payers associated with this facility
                    </p>
                  </div>

                  <div className="text-sm text-gray-600">
                    Payer linking will be available after facility creation
                  </div>
                </div>
              </div>
            )}

            {/* File Ingestion Tab */}
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
                          value: "HL7",
                          label: "HL7 (Health Level Seven)",
                          description:
                            "Traditional healthcare messaging standard",
                        },
                        {
                          value: "FHIR",
                          label:
                            "FHIR (Fast Healthcare Interoperability Resources)",
                          description:
                            "Modern API-based healthcare data standard",
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
                              formData.sftp_config?.poll_interval_seconds || 300
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
                            value={formData.local_config?.archive_folder || ""}
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
                                formData.local_config?.watch_recursive || false
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
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Add notes about this facility..."
                  />
                </div>

                {isEditMode && formData.created_at && (
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
                          {new Date(formData.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Last Updated:
                        </span>
                        <p className="text-gray-600 mt-1">
                          {new Date(formData.updated_at || formData.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
            <button
              onClick={() => navigate("/facilities")}
              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditMode ? "Update Facility" : "Add Facility"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditFacility;
