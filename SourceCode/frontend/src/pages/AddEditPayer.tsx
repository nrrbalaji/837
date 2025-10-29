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

const AddEditPayer: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "contact" | "transmission" | "notes"
  >("general");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    if (isEditMode && id) {
      fetchPayer(id);
    }
  }, [id, isEditMode]);

  const fetchPayer = async (payerId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/payers/${payerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payer = response.data;
      setFormData(payer);
      if (payer.sftp_config) {
        setSftpConfig(payer.sftp_config);
      }
      setNotes(payer.notes || "");
    } catch (error) {
      console.error("Error fetching payer:", error);
      showToast("error", "Failed to load payer data");
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

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        notes,
      };

      if (isEditMode && id) {
        await axios.put(`${API_BASE}/payers/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Payer updated successfully");
      } else {
        await axios.post(`${API_BASE}/payers`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Payer added successfully");
      }

      navigate("/payers");
    } catch (error: any) {
      if (error.response?.status === 409) {
        showToast("error", "Payer code already exists");
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
          <Loader className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payer data...</p>
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
            onClick={() => navigate("/payers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Payers
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? "Edit Payer" : "Add New Payer"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isEditMode
              ? "Update payer information and settings"
              : "Create a new payer profile with all required details"}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex">
              {[
                { key: "general", label: "General Info", icon: "📋" },
                { key: "contact", label: "Contact & Address", icon: "📍" },
                { key: "transmission", label: "Transmission", icon: "⚙️" },
                { key: "notes", label: "Notes & Audit", icon: "📝" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-teal-600 text-teal-600 bg-white"
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
                    Payer Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.payer_code}
                    onChange={(e) =>
                      setFormData({ ...formData, payer_code: e.target.value })
                    }
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                      errors.payer_code
                        ? "border-red-500"
                        : "border-gray-300"
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 ${
                      errors.payer_name
                        ? "border-red-500"
                        : "border-gray-300"
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
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white ${
                      errors.payer_type
                        ? "border-red-500"
                        : "border-gray-300"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                    placeholder="Trading partner identifier"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Electronic Payer ID <span className="text-red-500">*</span>
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
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

            {/* Transmission Tab */}
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                          placeholder="/inbox"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                    placeholder="Add notes about this payer..."
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
              onClick={() => navigate("/payers")}
              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditMode ? "Update Payer" : "Add Payer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditPayer;
