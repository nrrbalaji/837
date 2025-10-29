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

const AddEditTradingPartner: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "connection" | "edi" | "notes"
  >("general");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  const partnerTypes = ["Sender", "Receiver", "Both"];
  const directions = ["Inbound", "Outbound", "Bidirectional"];
  const channelTypes = ["SFTP", "API", "HL7", "FHIR"];
  const statuses = ["Active", "Inactive", "Testing"];

  useEffect(() => {
    if (isEditMode && id) {
      fetchTradingPartner(id);
    }
  }, [id, isEditMode]);

  const fetchTradingPartner = async (partnerId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/trading-partners/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const partner = response.data;
      setFormData(partner);
    } catch (error) {
      console.error("Error fetching trading partner:", error);
      showToast("error", "Failed to load trading partner data");
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

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = formData;

      if (isEditMode && id) {
        await axios.put(`${API_BASE}/trading-partners/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Trading partner updated successfully");
      } else {
        await axios.post(`${API_BASE}/trading-partners`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Trading partner added successfully");
      }

      navigate("/trading-partners");
    } catch (error: any) {
      if (error.response?.status === 409) {
        showToast("error", "Trading Partner ID already exists");
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
          <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading trading partner data...</p>
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
            onClick={() => navigate("/trading-partners")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Trading Partners
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? "Edit Trading Partner" : "Add New Trading Partner"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isEditMode
              ? "Update trading partner information and settings"
              : "Create a new trading partner profile with all required details"}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex">
              {[
                { key: "general", label: "General Info", icon: "📋" },
                { key: "connection", label: "Connection", icon: "🌐" },
                { key: "edi", label: "EDI Config", icon: "⚙️" },
                { key: "notes", label: "Notes & Audit", icon: "📝" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-purple-600 text-purple-600 bg-white"
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
                    disabled={isEditMode}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 ${
                      errors.trading_partner_id
                        ? "border-red-500"
                        : "border-gray-300"
                    } ${isEditMode ? "bg-gray-100" : ""}`}
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
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.test_mode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          test_mode: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Test Mode
                    </span>
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Effective To
                  </label>
                  <input
                    type="date"
                    value={formData.effective_to || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        effective_to: e.target.value,
                      })
                    }
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
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="Add notes about this trading partner..."
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
              onClick={() => navigate("/trading-partners")}
              className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditMode ? "Update Trading Partner" : "Add Trading Partner"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditTradingPartner;
