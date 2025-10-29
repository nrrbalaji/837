import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Loader,
  Plus,
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

interface Facility {
  facility_id: string;
  facility_name: string;
  facility_code: string;
}

const AddEditProvider: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [activeTab, setActiveTab] = useState<
    "general" | "address" | "payers" | "notes"
  >("general");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    fetchFacilities();
    if (isEditMode && id) {
      fetchProvider(id);
    }
  }, [id, isEditMode]);

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

  const fetchProvider = async (providerId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/providers/${providerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const provider = response.data;
      setFormData(provider);
      setPayerMappings(provider.payer_mappings || []);
      setNotes(provider.notes || "");
    } catch (error) {
      console.error("Error fetching provider:", error);
      showToast("error", "Failed to load provider data");
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

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        payer_mappings: payerMappings,
        notes,
      };

      if (isEditMode && id) {
        await axios.put(`${API_BASE}/providers/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Provider updated successfully");
      } else {
        await axios.post(`${API_BASE}/providers`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast("success", "Provider added successfully");
      }

      navigate("/providers");
    } catch (error: any) {
      showToast("error", error.response?.data?.error || "Operation failed");
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading provider data...</p>
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
            onClick={() => navigate("/providers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Providers
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? "Edit Provider" : "Add New Provider"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isEditMode
              ? "Update provider information and settings"
              : "Create a new provider profile with all required details"}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex">
              {[
                { key: "general", label: "General Info", icon: "📋" },
                { key: "address", label: "Address Info", icon: "📍" },
                { key: "payers", label: "Payer Mappings", icon: "💳" },
                { key: "notes", label: "Notes & Audit", icon: "📝" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
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
                  <button
                    onClick={addPayerMapping}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all"
                  >
                    <Plus size={16} />
                    Add Payer
                  </button>
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => removePayerMapping(index)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {payerMappings.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <span className="text-4xl">💳</span>
                      <p className="mt-2">No payer mappings added yet</p>
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
                    placeholder="Add notes about this provider..."
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
              onClick={() => navigate("/providers")}
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
              {isEditMode ? "Update Provider" : "Add Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditProvider;
