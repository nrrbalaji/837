import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  History,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface HistoryEntry {
  id: number;
  operation_type: string;
  status: string;
  notes: string;
  operation_date: string;
  user_detail: string;
}

const ClaimHistory: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fileId) {
      fetchHistory();
    }
  }, [fileId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/upload/claim-history/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setHistory(response.data.history || []);
      setFileName(response.data.fileName || "Unknown File");
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch claim history");
      console.error("Error fetching claim history:", err);
    } finally {
      setLoading(false);
    }
  };

  const getOperationIcon = (operationType: string) => {
    switch (operationType.toLowerCase()) {
      case "parsing":
        return <FileText className="text-blue-500" size={20} />;
      case "validation":
        return <CheckCircle className="text-green-500" size={20} />;
      case "auto correction":
        return <RefreshCw className="text-purple-500" size={20} />;
      case "manual correction":
        return <AlertCircle className="text-orange-500" size={20} />;
      case "export":
        return <History className="text-teal-500" size={20} />;
      default:
        return <Clock className="text-gray-500" size={20} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
      case "PASSED":
        return <CheckCircle className="text-green-500" size={16} />;
      case "FAILED":
      case "ERROR":
      case "VALIDATION_ERROR":
        return <XCircle className="text-red-500" size={16} />;
      case "WARNING":
        return <AlertCircle className="text-yellow-500" size={16} />;
      case "PENDING":
      case "PROCESSING":
        return <Clock className="text-blue-500" size={16} />;
      default:
        return <Clock className="text-gray-500" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "SUCCESS":
      case "PASSED":
        return "bg-green-100 text-green-700 border-green-200";
      case "FAILED":
      case "ERROR":
      case "VALIDATION_ERROR":
        return "bg-red-100 text-red-700 border-red-200";
      case "WARNING":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "PENDING":
      case "PROCESSING":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getOperationTypeBadge = (operationType: string) => {
    const baseClass =
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border";
    let colorClass = "bg-gray-100 text-gray-700 border-gray-200";

    switch (operationType.toLowerCase()) {
      case "parsing":
        colorClass = "bg-blue-100 text-blue-700 border-blue-200";
        break;
      case "validation":
        colorClass = "bg-green-100 text-green-700 border-green-200";
        break;
      case "auto correction":
        colorClass = "bg-purple-100 text-purple-700 border-purple-200";
        break;
      case "manual correction":
        colorClass = "bg-orange-100 text-orange-700 border-orange-200";
        break;
      case "export":
        colorClass = "bg-teal-100 text-teal-700 border-teal-200";
        break;
    }

    return `${baseClass} ${colorClass}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => navigate("/upload/history")}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ArrowLeft size={18} />
            Back to Upload History
          </button>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <History className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Claim History
            </h1>
            <p className="text-gray-600 mt-1">
              File:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                {fileName}
              </code>
              <br />
              {fileId && (
                <span className="text-xs text-gray-500">
                  File ID: {fileId.substring(0, 8)}...
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading claim history...
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
                  Error Loading History
                </h3>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={fetchHistory}
                  className="mt-3 btn-secondary inline-flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="text-gray-400" size={40} />
            </div>
            <p className="text-gray-700 font-medium mb-2">
              No history entries found
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This file hasn't undergone any operations yet, or processing is
              still in progress.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Operation Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      User
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {getOperationIcon(entry.operation_type)}
                          <span
                            className={getOperationTypeBadge(
                              entry.operation_type
                            )}
                          >
                            {entry.operation_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            entry.status
                          )}`}
                        >
                          {getStatusIcon(entry.status)}
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                        <div className="truncate" title={entry.notes}>
                          {entry.notes}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDateTime(entry.operation_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">
                            {entry.user_detail
                              ? entry.user_detail.charAt(0).toUpperCase()
                              : "?"}
                          </div>
                          <span className="text-sm text-gray-700">
                            {entry.user_detail || "System"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>
                  <strong>Total Operations:</strong> {history.length}
                </div>
                <div className="flex gap-4">
                  <span className="text-green-600">
                    ✓ Success:{" "}
                    {
                      history.filter(
                        (h) =>
                          h.status?.toUpperCase() === "SUCCESS" ||
                          h.status?.toUpperCase() === "PASSED"
                      ).length
                    }
                  </span>
                  <span className="text-red-600">
                    ✗ Failed:{" "}
                    {
                      history.filter(
                        (h) =>
                          h.status?.toUpperCase() === "FAILED" ||
                          h.status?.toUpperCase() === "ERROR"
                      ).length
                    }
                  </span>
                  <span className="text-blue-600">
                    ⏳ Pending:{" "}
                    {
                      history.filter(
                        (h) =>
                          h.status?.toUpperCase() === "PENDING" ||
                          h.status?.toUpperCase() === "PROCESSING"
                      ).length
                    }
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimHistory;
