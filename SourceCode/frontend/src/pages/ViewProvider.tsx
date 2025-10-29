import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Edit,
  AlertCircle,
  Loader,
  Building2,
  Users,
  MapPin,
  CreditCard,
  Clock,
  Mail,
  Phone,
  FileText,
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
  notes?: string;
}

interface PayerMapping {
  payer_mapping_id?: string;
  payer_name: string;
  payer_id: string;
  enrollment_status: string;
  effective_date: string;
  termination_date?: string;
}

const ViewProvider: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "address" | "payers" | "notes"
  >("general");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProvider(id);
    }
  }, [id]);

  const fetchProvider = async (providerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/providers/${providerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProvider(response.data);
    } catch (error: any) {
      console.error("Error fetching provider:", error);
      setError("Failed to load provider data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading provider details...</p>
        </div>
      </div>
    );
  }

  if (error || !provider) {
    return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/providers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Providers
          </button>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || "Provider not found"}
            </h2>
            <p className="text-gray-600">
              The provider you're looking for doesn't exist or has been removed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/providers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Providers
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {provider.provider_name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Provider Profile Details
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/providers/edit/${provider.provider_id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md"
            >
              <Edit size={18} />
              Edit Provider
            </button>
          </div>
        </div>

        {/* Content Container */}
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

          {/* Tab Content */}
          <div className="p-6">
            {/* General Info Tab */}
            {activeTab === "general" && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Provider Name
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Users className="text-blue-600" size={20} />
                    <span className="text-gray-900 font-medium">
                      {provider.provider_name}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NPI
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {provider.npi}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tax ID
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {provider.tax_id}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Specialty
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {provider.facility_type}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Taxonomy Code
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900">
                      {provider.taxonomy_code}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
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
                  </div>
                </div>
              </div>
            )}

            {/* Address Info Tab */}
            {activeTab === "address" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="text-blue-600 mt-1" size={20} />
                    <div className="text-gray-900">
                      {provider.address && (
                        <div>{provider.address}</div>
                      )}
                      {provider.city && provider.state && (
                        <div>
                          {provider.city}, {provider.state} {provider.zip}
                        </div>
                      )}
                      {provider.country && provider.country !== "USA" && (
                        <div>{provider.country}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {provider.contact_name && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Users className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Contact Name
                          </div>
                          <div className="text-gray-900 font-medium">
                            {provider.contact_name}
                          </div>
                        </div>
                      </div>
                    )}

                    {provider.contact_email && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Mail className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Email
                          </div>
                          <div className="text-gray-900 font-medium">
                            {provider.contact_email}
                          </div>
                        </div>
                      </div>
                    )}

                    {provider.contact_phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Phone
                          </div>
                          <div className="text-gray-900 font-medium">
                            {provider.contact_phone}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payer Mappings Tab */}
            {activeTab === "payers" && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Payer Mappings
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Insurance payers associated with this provider
                  </p>
                </div>

                <div className="space-y-4">
                  {provider.payer_mappings && provider.payer_mappings.length > 0 ? (
                    provider.payer_mappings.map((mapping, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Payer Name
                            </label>
                            <div className="flex items-center gap-2">
                              <CreditCard className="text-blue-600" size={16} />
                              <span className="text-gray-900 font-medium">
                                {mapping.payer_name}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Payer ID
                            </label>
                            <span className="text-gray-900 font-mono text-sm">
                              {mapping.payer_id}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Enrollment Status
                            </label>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                mapping.enrollment_status === "Active"
                                  ? "bg-green-100 text-green-700"
                                  : mapping.enrollment_status === "Pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {mapping.enrollment_status}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Effective Date
                            </label>
                            <span className="text-gray-900 text-sm">
                              {new Date(mapping.effective_date).toLocaleDateString()}
                            </span>
                          </div>
                          {mapping.termination_date && (
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Termination Date
                              </label>
                              <span className="text-gray-900 text-sm">
                                {new Date(mapping.termination_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CreditCard className="mx-auto mb-3 text-gray-400" size={40} />
                      <p>No payer mappings found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes & Audit Tab */}
            {activeTab === "notes" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notes
                  </label>
                  <div className="p-4 bg-gray-50 rounded-lg min-h-[120px]">
                    {provider.notes ? (
                      <div className="flex items-start gap-3">
                        <FileText className="text-blue-600 mt-1" size={20} />
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {provider.notes}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <FileText className="mr-2" size={20} />
                        No notes available
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Audit Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="text-blue-600" size={20} />
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Created At
                        </div>
                        <div className="text-gray-900 font-medium">
                          {new Date(provider.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="text-blue-600" size={20} />
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Last Updated
                        </div>
                        <div className="text-gray-900 font-medium">
                          {new Date(provider.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProvider;
