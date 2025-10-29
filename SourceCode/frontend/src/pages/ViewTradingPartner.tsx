import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Edit,
  AlertCircle,
  Loader,
  Network,
  Globe,
  Settings,
  Clock,
  FileText,
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

const ViewTradingPartner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<TradingPartner | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "connection" | "edi" | "notes"
  >("general");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTradingPartner(id);
    }
  }, [id]);

  const fetchTradingPartner = async (partnerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/trading-partners/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPartner(response.data);
    } catch (error: any) {
      console.error("Error fetching trading partner:", error);
      setError("Failed to load trading partner data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading trading partner details...</p>
        </div>
      </div>
    );
  }

  if (error || !partner) {
    return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/trading-partners")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Trading Partners
          </button>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || "Trading partner not found"}
            </h2>
            <p className="text-gray-600">
              The trading partner you're looking for doesn't exist or has been removed.
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
            onClick={() => navigate("/trading-partners")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Trading Partners
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Network className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {partner.partner_name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Trading Partner Profile Details
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/trading-partners/edit/${partner.trading_partner_id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all shadow-md"
            >
              <Edit size={18} />
              Edit Trading Partner
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

          {/* Tab Content */}
          <div className="p-6">
            {/* General Info Tab */}
            {activeTab === "general" && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trading Partner ID
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Network className="text-purple-600" size={20} />
                    <span className="text-gray-900 font-medium">
                      {partner.trading_partner_id}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Partner Name
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-medium">
                      {partner.partner_name}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Partner Type
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {partner.partner_type}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Direction
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {partner.direction}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sender Qualifier
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {partner.sender_qualifier}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sender ID
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {partner.sender_id}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Receiver Qualifier
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {partner.receiver_qualifier}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Receiver ID
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {partner.receiver_id}
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
                        partner.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : partner.status === "Inactive"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {partner.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Test Mode
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      partner.test_mode
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {partner.test_mode ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Connection Tab */}
            {activeTab === "connection" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Channel Type
                    </label>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Globe className="text-purple-600" size={20} />
                      <span className="text-gray-900 font-medium">
                        {partner.channel_type}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Endpoint URL
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-900 text-sm break-all">
                        {partner.endpoint_url}
                      </span>
                    </div>
                  </div>
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
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Settings className="text-purple-600" size={20} />
                    <span className="text-gray-900 font-medium">
                      {partner.edi_version}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Effective From
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900">
                      {new Date(partner.effective_from).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Effective To
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900">
                      {partner.effective_to
                        ? new Date(partner.effective_to).toLocaleDateString()
                        : "No end date"}
                    </span>
                  </div>
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
                    {partner.notes ? (
                      <div className="flex items-start gap-3">
                        <FileText className="text-purple-600 mt-1" size={20} />
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {partner.notes}
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
                      <Clock className="text-purple-600" size={20} />
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Created At
                        </div>
                        <div className="text-gray-900 font-medium">
                          {new Date(partner.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="text-purple-600" size={20} />
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          Last Updated
                        </div>
                        <div className="text-gray-900 font-medium">
                          {new Date(partner.updated_at).toLocaleString()}
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

export default ViewTradingPartner;
