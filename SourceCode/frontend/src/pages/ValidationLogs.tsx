import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Code,
  Briefcase,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  Edit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "http://10.1.9.210:3000/api/v1";

interface ValidationLog {
  validation_id: string;
  file_id: string;
  claim_id?: string;
  claim_number?: string;
  log_type: "FILE" | "EDI" | "BUSINESS";
  validation_type: string;
  rule_name: string;
  segment_id?: string;
  field_name?: string;
  error_message: string;
  severity: "ERROR" | "WARNING" | "INFO";
  details?: string;
  validated_at: string;
}

interface ValidationSummary {
  summary: {
    file_validations: number;
    edi_validations: number;
    business_validations: number;
  };
  fileValidations: Array<{
    validation_rule: string;
    severity: string;
    count: number;
  }>;
  ediValidations: Array<{
    segment_id: string;
    severity: string;
    count: number;
  }>;
  businessValidations: Array<{
    severity: string;
    count: number;
    affected_claims: number;
  }>;
}

const ValidationLogs: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileId = searchParams.get("fileId");
  const claimId = searchParams.get("claimId");

  const [logs, setLogs] = useState<ValidationLog[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "all" | "file" | "edi" | "business"
  >("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (fileId) {
      fetchValidationLogs();
      fetchSummary();
    } else if (claimId) {
      fetchBusinessLogs();
    }
  }, [fileId, claimId, activeTab, filterSeverity, currentPage]);

  const fetchValidationLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      let url = "";
      if (activeTab === "all") {
        url = `${API_BASE}/validation-logs/all/${fileId}?page=${currentPage}&severity=${filterSeverity}`;
      } else if (activeTab === "file") {
        url = `${API_BASE}/validation-logs/file/${fileId}`;
      } else if (activeTab === "edi") {
        url = `${API_BASE}/validation-logs/edi/${fileId}`;
      } else if (activeTab === "business") {
        url = `${API_BASE}/validation-logs/all/${fileId}?type=BUSINESS`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (activeTab === "all" || activeTab === "business") {
        setLogs(response.data.logs || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setLogs(Array.isArray(response.data) ? response.data : []);
      }

      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch validation logs");
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/validation-logs/business/${claimId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setLogs(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch validation logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/validation-logs/summary/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSummary(response.data);
    } catch (err: any) {
      console.error("Error fetching summary:", err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "ERROR":
        return "bg-red-100 text-red-700 border-red-200";
      case "WARNING":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "INFO":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case "FILE":
        return "bg-purple-100 text-purple-700";
      case "EDI":
        return "bg-indigo-100 text-indigo-700";
      case "BUSINESS":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case "FILE":
        return <FileText size={16} />;
      case "EDI":
        return <Code size={16} />;
      case "BUSINESS":
        return <Briefcase size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.rule_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting function
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "timestamp":
        aValue = new Date(a.validated_at).getTime();
        bValue = new Date(b.validated_at).getTime();
        break;
      case "type":
        aValue = a.log_type || "";
        bValue = b.log_type || "";
        break;
      case "severity":
        aValue = a.severity;
        bValue = b.severity;
        break;
      case "rule":
        aValue = (a.rule_name || a.validation_type || "").toLowerCase();
        bValue = (b.rule_name || b.validation_type || "").toLowerCase();
        break;
      case "location":
        aValue = (
          a.segment_id ||
          a.field_name ||
          a.details ||
          ""
        ).toLowerCase();
        bValue = (
          b.segment_id ||
          b.field_name ||
          b.details ||
          ""
        ).toLowerCase();
        break;
      case "message":
        aValue = a.error_message.toLowerCase();
        bValue = b.error_message.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown size={14} />;
    return sortDirection === "asc" ? (
      <ArrowUp size={14} />
    ) : (
      <ArrowDown size={14} />
    );
  };

  if (!fileId && !claimId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-yellow-600" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-1">
                Missing Parameters
              </h3>
              <p className="text-yellow-800">
                Please provide a fileId or claimId parameter to view validation
                logs.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <AlertCircle className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Validation Logs
              </h1>
              <p className="text-gray-600 mt-1">
                {fileId
                  ? "File validation details and error tracking"
                  : "Claim validation details"}
              </p>
            </div>
          </div>
          {fileId && (
            <button
              onClick={() => navigate(`/manual-correction?fileId=${fileId}`)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all"
            >
              <Edit size={20} />
              Manual Correction
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && fileId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="text-purple-600" size={28} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  File Validations
                </h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summary.summary.file_validations}
                </p>
              </div>
            </div>
          </div>
          <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Code className="text-indigo-600" size={28} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  EDI Validations
                </h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summary.summary.edi_validations}
                </p>
              </div>
            </div>
          </div>
          <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                <Briefcase className="text-green-600" size={28} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  Business Rules
                </h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summary.summary.business_validations}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Filters */}
      {fileId && (
        <div className="card shadow-lg border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap">
              {[
                { key: "all", label: "All Logs", icon: AlertCircle },
                { key: "file", label: "File Validations", icon: FileText },
                { key: "edi", label: "EDI Validations", icon: Code },
                { key: "business", label: "Business Rules", icon: Briefcase },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as any);
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-primary-500 text-primary-600 bg-primary-50"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6 flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 !important"
                  style={{ color: "#111827" }}
                />
              </div>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-3">
              <Filter className="text-gray-500" size={18} />
              <label className="text-sm font-medium text-gray-700">
                Severity:
              </label>
              <select
                value={filterSeverity}
                onChange={(e) => {
                  setFilterSeverity(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
              >
                <option value="">All</option>
                <option value="ERROR">Errors</option>
                <option value="WARNING">Warnings</option>
                <option value="INFO">Info</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Logs Display */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading validation logs...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-red-600" size={22} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-1">
                  Error Loading Logs
                </h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 font-medium">
              No validation logs found
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "This file has no validation errors"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => handleSort("timestamp")}
                    >
                      <div className="flex items-center gap-2">
                        Timestamp
                        {getSortIcon("timestamp")}
                      </div>
                    </th>
                    {activeTab === "all" && (
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => handleSort("type")}
                      >
                        <div className="flex items-center gap-2">
                          Type
                          {getSortIcon("type")}
                        </div>
                      </th>
                    )}
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => handleSort("severity")}
                    >
                      <div className="flex items-center gap-2">
                        Severity
                        {getSortIcon("severity")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => handleSort("rule")}
                    >
                      <div className="flex items-center gap-2">
                        Rule
                        {getSortIcon("rule")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => handleSort("location")}
                    >
                      <div className="flex items-center gap-2">
                        Location
                        {getSortIcon("location")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
                      onClick={() => handleSort("message")}
                    >
                      <div className="flex items-center gap-2">
                        Message
                        {getSortIcon("message")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedLogs.map((log) => (
                    <tr
                      key={log.validation_id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(log.validated_at).toLocaleString()}
                      </td>
                      {activeTab === "all" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getLogTypeColor(
                              log.log_type
                            )}`}
                          >
                            {getLogTypeIcon(log.log_type)}
                            {log.log_type}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(
                            log.severity
                          )}`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.rule_name || log.validation_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {log.segment_id ||
                            log.field_name ||
                            log.details ||
                            "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <p className="mb-1">{log.error_message}</p>
                        {log.claim_number && (
                          <span className="inline-block text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            Claim: {log.claim_number}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {activeTab === "all" && totalPages > 1 && (
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
    </div>
  );
};

export default ValidationLogs;
