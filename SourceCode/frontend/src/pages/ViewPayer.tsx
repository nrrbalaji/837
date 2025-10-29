import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Edit,
  AlertCircle,
  Loader,
  Building2,
  MapPin,
  Settings,
  Clock,
  Mail,
  Phone,
  FileText,
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
  sftp_config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
}

const ViewPayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [payer, setPayer] = useState<Payer | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "contact" | "transmission" | "notes"
  >("general");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchPayer(id);
    }
  }, [id]);

  const fetchPayer = async (payerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/payers/${payerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPayer(response.data);
    } catch (error: any) {
      console.error("Error fetching payer:", error);
      setError("Failed to load payer data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payer details...</p>
        </div>
      </div>
    );
  }

  if (error || !payer) {
    return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/payers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Payers
          </button>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || "Payer not found"}
            </h2>
            <p className="text-gray-600">
              The payer you're looking for doesn't exist or has been removed.
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
            onClick={() => navigate("/payers")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Payers
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {payer.payer_name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Payer Profile Details
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/payers/edit/${payer.payer_id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-all shadow-md"
            >
              <Edit size={18} />
              Edit Payer
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

          {/* Tab Content */}
          <div className="p-6">
            {/* General Info Tab */}
            {activeTab === "general" && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payer Name
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building2 className="text-teal-600" size={20} />
                    <span className="text-gray-900 font-medium">
                      {payer.payer_name}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payer Code
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {payer.payer_code}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payer Type
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {payer.payer_type}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trading Partner ID
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900">
                      {payer.trading_partner_id || "Not specified"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Electronic Payer ID
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {payer.electronic_payer_id}
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
                        payer.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {payer.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Contact & Address Tab */}
            {activeTab === "contact" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="text-teal-600 mt-1" size={20} />
                    <div className="text-gray-900">
                      {payer.address_line1 && (
                        <div>{payer.address_line1}</div>
                      )}
                      {payer.address_line2 && (
                        <div>{payer.address_line2}</div>
                      )}
                      {(payer.city || payer.state || payer.zip_code) && (
                        <div>
                          {payer.city && `${payer.city}, `}
                          {payer.state && `${payer.state} `}
                          {payer.zip_code}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {payer.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="text-teal-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Phone
                          </div>
                          <div className="text-gray-900 font-medium">
                            {payer.phone}
                          </div>
                        </div>
                      </div>
                    )}

                    {payer.fax && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="text-teal-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Fax
                          </div>
                          <div className="text-gray-900 font-medium">
                            {payer.fax}
                          </div>
                        </div>
                      </div>
                    )}

                    {payer.email && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Mail className="text-teal-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Email
                          </div>
                          <div className="text-gray-900 font-medium">
                            {payer.email}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Settings className="text-teal-600" size={20} />
                      <span className="text-gray-900 font-medium">
                        {payer.transmission_method}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Endpoint URL
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-900 text-sm break-all">
                        {payer.endpoint_url || "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>

                {payer.transmission_method === "SFTP" && payer.sftp_config && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      SFTP Configuration
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Host
                        </span>
                        <span className="text-gray-900 font-medium">
                          {payer.sftp_config.host || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Port
                        </span>
                        <span className="text-gray-900 font-medium">
                          {payer.sftp_config.port || "22"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Username
                        </span>
                        <span className="text-gray-900 font-medium">
                          {payer.sftp_config.username || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Remote Path
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {payer.sftp_config.remotePath || "/"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
                    {payer.notes ? (
                      <div className="flex items-start gap-3">
                        <FileText className="text-teal-600 mt-1" size={20} />
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {payer.notes}
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
                      <Clock className="text-teal-600" size={20} />
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Created At
                        </div>
                        <div className="text-gray-900 font-medium">
                          {new Date(payer.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="text-teal-600" size={20} />
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Last Updated
                        </div>
                        <div className="text-gray-900 font-medium">
                          {new Date(payer.updated_at).toLocaleString()}
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

export default ViewPayer;
