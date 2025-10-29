import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ChevronLeft,
  Edit,
  AlertCircle,
  Loader,
  Building,
  Users,
  MapPin,
  Clock,
  Mail,
  Phone,
  FileText,
  FolderInput,
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
  contact_person?: string;
  default_billing_location?: boolean;
  notes?: string;
}

const ViewFacility: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [activeTab, setActiveTab] = useState<
    "general" | "address" | "operational" | "ingestion" | "notes"
  >("general");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchFacility(id);
    }
  }, [id]);

  const fetchFacility = async (facilityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/facilities/${facilityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const facilityData = response.data;

      // Parse ingestion_config if it exists and is a string
      let parsedConfig = facilityData.ingestion_config;
      if (typeof parsedConfig === "string") {
        try {
          parsedConfig = JSON.parse(parsedConfig);
        } catch (e) {
          console.error("Error parsing ingestion_config:", e);
          parsedConfig = null;
        }
      }

      setFacility({
        ...facilityData,
        ingestion_config: parsedConfig,
      });
    } catch (error: any) {
      console.error("Error fetching facility:", error);
      setError("Failed to load facility data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading facility details...</p>
        </div>
      </div>
    );
  }

  if (error || !facility) {
    return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/facilities")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Facilities
          </button>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || "Facility not found"}
            </h2>
            <p className="text-gray-600">
              The facility you're looking for doesn't exist or has been removed.
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
            onClick={() => navigate("/facilities")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Facilities
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building className="text-white" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {facility.facility_name}
                </h1>
                <p className="text-gray-600 mt-1">
                  Facility Profile Details
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/facilities/edit/${facility.facility_id}`)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md"
            >
              <Edit size={18} />
              Edit Facility
            </button>
          </div>
        </div>

        {/* Content Container */}
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

          {/* Tab Content */}
          <div className="p-6">
            {/* General Info Tab */}
            {activeTab === "general" && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Facility Name
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building className="text-blue-600" size={20} />
                    <span className="text-gray-900 font-medium">
                      {facility.facility_name}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Facility Code
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {facility.facility_code}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Facility Type
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {facility.facility_type}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NPI
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {facility.npi}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tax ID
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-900 font-mono">
                      {facility.tax_id}
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
                        facility.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {facility.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Address & Contact Tab */}
            {activeTab === "address" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="text-blue-600 mt-1" size={20} />
                    <div className="text-gray-900">
                      {facility.address_line1 && (
                        <div>{facility.address_line1}</div>
                      )}
                      {facility.address_line2 && (
                        <div>{facility.address_line2}</div>
                      )}
                      {(facility.city || facility.state || facility.zip_code) && (
                        <div>
                          {facility.city && `${facility.city}, `}
                          {facility.state && `${facility.state} `}
                          {facility.zip_code}
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
                    {facility.contact_person && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Users className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Contact Person
                          </div>
                          <div className="text-gray-900 font-medium">
                            {facility.contact_person}
                          </div>
                        </div>
                      </div>
                    )}

                    {facility.phone && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Phone
                          </div>
                          <div className="text-gray-900 font-medium">
                            {facility.phone}
                          </div>
                        </div>
                      </div>
                    )}

                    {facility.fax && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Phone className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Fax
                          </div>
                          <div className="text-gray-900 font-medium">
                            {facility.fax}
                          </div>
                        </div>
                      </div>
                    )}

                    {facility.email && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Mail className="text-blue-600" size={20} />
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Email
                          </div>
                          <div className="text-gray-900 font-medium">
                            {facility.email}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Operational Tab */}
            {activeTab === "operational" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Active
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      facility.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {facility.is_active ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Default Billing Location
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      facility.default_billing_location
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {facility.default_billing_location ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Linked Payers
                  </h3>
                  <div className="text-sm text-gray-600">
                    Payer linking information will be displayed here when available.
                  </div>
                </div>
              </div>
            )}

            {/* File Ingestion Tab */}
            {activeTab === "ingestion" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ingestion Mode
                    </label>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FolderInput className="text-blue-600" size={20} />
                      <span className="text-gray-900 font-medium">
                        {facility.ingestion_mode || "REST API"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data Format
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-900 font-medium">
                        {facility.data_format || "HL7"}
                      </span>
                    </div>
                  </div>
                </div>

                {facility.ingestion_mode === "SFTP" && facility.ingestion_config?.sftp && (
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
                          {facility.ingestion_config.sftp.host || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Port
                        </span>
                        <span className="text-gray-900 font-medium">
                          {facility.ingestion_config.sftp.port || "22"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Username
                        </span>
                        <span className="text-gray-900 font-medium">
                          {facility.ingestion_config.sftp.username || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Input Folder
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {facility.ingestion_config.sftp.input_folder || "/inbound/837"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Output Folder
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {facility.ingestion_config.sftp.output_folder || "/outbound/837"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Archive Folder
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {facility.ingestion_config.sftp.archive_folder || "Not specified"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {facility.ingestion_mode === "LOCAL_FOLDER" && facility.ingestion_config?.local && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Local Folder Configuration
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Input Folder
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {facility.ingestion_config.local.input_folder || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Output Folder
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {facility.ingestion_config.local.output_folder || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Archive Folder
                        </span>
                        <span className="text-gray-900 font-medium font-mono text-sm">
                          {facility.ingestion_config.local.archive_folder || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Watch Recursive
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          facility.ingestion_config.local.watch_recursive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {facility.ingestion_config.local.watch_recursive ? "Yes" : "No"}
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
                    {facility.notes ? (
                      <div className="flex items-start gap-3">
                        <FileText className="text-blue-600 mt-1" size={20} />
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {facility.notes}
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
                          {new Date(facility.created_at).toLocaleString()}
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
                          {new Date(facility.updated_at).toLocaleString()}
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

export default ViewFacility;
