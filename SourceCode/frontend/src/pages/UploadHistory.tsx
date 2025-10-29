import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  History,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
  Eye,
  GitBranch,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface UploadedFile {
  file_id: string;
  file_name: string;
  file_size_bytes: number;
  upload_status: string;
  uploaded_at: string;
  parsed_at?: string;
  parsing_summary?: any;
  uploaded_by_username: string;
}

const UploadHistory: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchUploadHistory();
  }, [currentPage]);

  const fetchUploadHistory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/upload/history?page=${currentPage}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setFiles(response.data.files);
      setTotalPages(response.data.pagination.totalPages);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch upload history");
      console.error("Error fetching upload history:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PARSED":
        return <CheckCircle className="text-green-500" size={20} />;
      case "PARSING":
        return <Clock className="text-blue-500" size={20} />;
      case "FAILED":
      case "VALIDATION_FAILED":
        return <XCircle className="text-red-500" size={20} />;
      case "DUPLICATE":
        return <AlertCircle className="text-yellow-500" size={20} />;
      default:
        return <FileText className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PARSED":
        return "bg-green-100 text-green-700 border-green-200";
      case "PARSING":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "FAILED":
      case "VALIDATION_FAILED":
        return "bg-red-100 text-red-700 border-red-200";
      case "DUPLICATE":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const getStatusBadgeStyle = (status: string) => {
    const baseClass =
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border";
    return `${baseClass} ${getStatusColor(status)}`;
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <History className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Upload History
            </h1>
            <p className="text-gray-600 mt-1">
              View all uploaded files and their validation status
            </p>
          </div>
          <button
            onClick={() => fetchUploadHistory(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} size={18} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-0.5">Total Files</p>
              <p className="text-2xl font-bold text-gray-900">{files.length}</p>
            </div>
          </div>
        </div>
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-0.5">Parsed</p>
              <p className="text-2xl font-bold text-gray-900">
                {files.filter((f) => f.upload_status === "PARSED").length}
              </p>
            </div>
          </div>
        </div>
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-0.5">Failed</p>
              <p className="text-2xl font-bold text-gray-900">
                {
                  files.filter(
                    (f) =>
                      f.upload_status === "FAILED" ||
                      f.upload_status === "VALIDATION_FAILED"
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-0.5">Processing</p>
              <p className="text-2xl font-bold text-gray-900">
                {files.filter((f) => f.upload_status === "PARSING").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Files Table */}
      <div className="card shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading upload history...
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
              </div>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-gray-400" size={40} />
            </div>
            <p className="text-gray-700 font-medium mb-2">
              No files uploaded yet
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Get started by uploading your first 837 claim file
            </p>
            <button
              onClick={() => navigate("/upload")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all shadow-md hover:shadow-lg"
            >
              <Upload size={18} />
              Upload Your First File
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Claims
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Uploaded By
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr
                      key={file.file_id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="text-primary-600" size={20} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 mb-0.5">
                              {file.file_name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {file.file_id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={getStatusBadgeStyle(file.upload_status)}
                        >
                          {getStatusIcon(file.upload_status)}
                          {file.upload_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                        {formatFileSize(file.file_size_bytes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {file.parsing_summary?.totalClaims ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                            {file.parsing_summary.totalClaims} claims
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(file.uploaded_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">
                            {file.uploaded_by_username
                              ? file.uploaded_by_username
                                  .charAt(0)
                                  .toUpperCase()
                              : "?"}
                          </div>
                          <span className="text-sm text-gray-700">
                            {file.uploaded_by_username || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              navigate(
                                `/validation-logs?fileId=${file.file_id}`
                              )
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
                          >
                            <Eye size={16} />
                            View Logs
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/claim-history/${file.file_id}`)
                            }
                            className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-all shadow-sm hover:shadow-md"
                            title="View operation history for this file"
                          >
                            <History size={16} />
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/parsed-json-history?fileId=${file.file_id}`
                              )
                            }
                            className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
                            title="View parsed JSON change history"
                          >
                            <GitBranch size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
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

export default UploadHistory;
