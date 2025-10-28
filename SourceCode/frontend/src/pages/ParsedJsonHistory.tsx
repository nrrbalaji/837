import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  GitBranch,
  Clock,
  User,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  Code,
  FileJson,
  FileText,
  Activity,
  Building,
  Heart,
  Plus,
  Minus,
  Edit3,
  Hash,
} from "lucide-react";

// Change Summary Display Component
const ChangeSummaryDisplay: React.FC<{ summary: any }> = ({ summary }) => {
  // If summary is a simple object, display key-value pairs
  if (typeof summary === "object" && summary !== null) {
    return <ChangeSummaryRenderer data={summary} level={0} />;
  }

  // Fallback for non-object summaries
  return (
    <p className="text-xs text-gray-600">
      {typeof summary === "string" ? summary : String(summary)}
    </p>
  );
};

// Side-by-Side Diff Display Component with Color Coding
const DataChangesDisplay: React.FC<{ previousValue: any; newValue: any }> = ({
  previousValue,
  newValue,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  // Generate flat key-value pairs with paths from nested objects
  const flattenObject = (
    obj: any,
    prefix: string = ""
  ): Array<{ path: string; value: any; type: string }> => {
    const result: Array<{ path: string; value: any; type: string }> = [];

    if (obj === null || obj === undefined) {
      result.push({ path: prefix, value: obj, type: "primitive" });
      return result;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
        if (typeof item === "object" && item !== null) {
          result.push(...flattenObject(item, path));
        } else {
          result.push({ path, value: item, type: "array-item" });
        }
      });
      return result;
    }

    if (typeof obj === "object") {
      Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null) {
          result.push(...flattenObject(value, path));
        } else {
          result.push({ path, value, type: "object-property" });
        }
      });
      return result;
    }

    result.push({ path: prefix, value: obj, type: "primitive" });
    return result;
  };

  // Compare two flattened arrays and identify changes
  const compareFlattenedData = (
    prevFlattened: Array<{ path: string; value: any; type: string }>,
    currFlattened: Array<{ path: string; value: any; type: string }>
  ): Array<{
    path: string;
    changeType: "unchanged" | "added" | "removed" | "modified";
    previousValue?: any;
    currentValue?: any;
    category: string;
  }> => {
    const result: Array<any> = [];
    const allPaths = new Set([
      ...prevFlattened.map((p) => p.path),
      ...currFlattened.map((p) => p.path),
    ]);

    allPaths.forEach((path) => {
      const prevItem = prevFlattened.find((p) => p.path === path);
      const currItem = currFlattened.find((p) => p.path === path);

      // Determine category (top-level object)
      const category = path.split(".")[0] || path.split("[")[0] || "root";

      if (prevItem && currItem) {
        // Both exist - check if values are the same
        if (String(prevItem.value) !== String(currItem.value)) {
          result.push({
            path,
            changeType: "modified",
            previousValue: prevItem.value,
            currentValue: currItem.value,
            category,
          });
        } else {
          result.push({
            path,
            changeType: "unchanged",
            previousValue: currItem.value,
            currentValue: currItem.value,
            category,
          });
        }
      } else if (prevItem && !currItem) {
        // Removed
        result.push({
          path,
          changeType: "removed",
          previousValue: prevItem.value,
          category,
        });
      } else if (!prevItem && currItem) {
        // Added
        result.push({
          path,
          changeType: "added",
          currentValue: currItem.value,
          category,
        });
      }
    });

    return result;
  };

  // Get main claim data for comparison
  const getMainClaimData = (data: any) => {
    return data?.claims?.[0]?.claims?.[0] || data?.claims?.[0] || data;
  };

  const prevClaim = getMainClaimData(previousValue);
  const currClaim = getMainClaimData(newValue);

  // Flatten both objects
  const prevFlattened = flattenObject(prevClaim);
  const currFlattened = flattenObject(currClaim);

  // Compare flattened data
  const allChanges = compareFlattenedData(prevFlattened, currFlattened);

  // Group by category
  const changesByCategory = allChanges.reduce((acc, change) => {
    if (!acc[change.category]) {
      acc[change.category] = [];
    }
    acc[change.category].push(change);
    return acc;
  }, {} as Record<string, typeof allChanges>);

  const formatValue = (value: any) => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string" && value.length > 40) {
      return `"${value.substring(0, 40)}..."`;
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getRowClass = (changeType: string) => {
    switch (changeType) {
      case "added":
        return "bg-green-50 border-green-200";
      case "removed":
        return "bg-red-50 border-red-200";
      case "modified":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getValueCellClass = (changeType: string, isPrevious: boolean) => {
    if (changeType === "removed") {
      return isPrevious ? "bg-red-100 text-red-800 font-medium" : "";
    }
    if (changeType === "added") {
      return !isPrevious ? "bg-green-100 text-green-800 font-medium" : "";
    }
    if (changeType === "modified") {
      return isPrevious
        ? "bg-red-100 text-red-700"
        : "bg-green-100 text-green-700 font-medium";
    }
    return "";
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">
        Corrected Fields (Before → After Comparison)
      </h4>

      <div className="space-y-3">
        {Object.entries(changesByCategory).map(([category, changes]) => {
          const hasChanges = changes.some((c) => c.changeType !== "unchanged");
          const isExpanded = expandedSections.has(category);

          if (!hasChanges) return null;

          return (
            <div
              key={category}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div
                className="bg-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => toggleSection(category)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {category.replace(/[[\]]/g, "")} Section
                  </span>
                  <span className="text-xs text-gray-500">
                    (
                    {changes.filter((c) => c.changeType !== "unchanged").length}{" "}
                    changes)
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Field Path
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-red-50">
                          Before (Removed)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-green-50">
                          After (Added)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Change Type
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {changes
                        .filter((change) => change.changeType !== "unchanged")
                        .map((change, index) => (
                        <tr
                          key={index}
                          className={getRowClass(change.changeType)}
                        >
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {change.path}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm font-mono ${getValueCellClass(
                              change.changeType,
                              true
                            )}`}
                          >
                            {change.changeType === "removed" ||
                            change.changeType === "modified"
                              ? formatValue(change.previousValue)
                              : ""}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm font-mono ${getValueCellClass(
                              change.changeType,
                              false
                            )}`}
                          >
                            {change.changeType === "added" ||
                            change.changeType === "modified"
                              ? formatValue(change.currentValue)
                              : ""}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                change.changeType === "added"
                                  ? "bg-green-100 text-green-800"
                                  : change.changeType === "removed"
                                  ? "bg-red-100 text-red-800"
                                  : change.changeType === "modified"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              <span className="capitalize">
                                {change.changeType}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-500 mt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Added fields (green)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Removed fields (red)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Modified fields (yellow)</span>
          </div>
        </div>
        <p className="mt-1">
          Click section headers to expand/collapse. Shows field-level changes in
          structured tabular format.
        </p>
      </div>
    </div>
  );
};

// Recursive renderer for nested change summary data
const ChangeSummaryRenderer: React.FC<{ data: any; level: number }> = ({
  data,
  level,
}) => {
  if (level > 3) {
    // Prevent infinite recursion
    return <span className="text-xs text-gray-500">[Complex Data]</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-xs text-gray-500">Empty array</span>;
    }

    // Show all items for small arrays (1-5 items), collapse for larger ones
    const maxInlineItems = 5;
    const showExpanded = data.length <= maxInlineItems;

    if (showExpanded) {
      // Show actual content for small arrays
      return (
        <div className="space-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-xs font-medium text-gray-600">•</span>
              <div className="flex-1">
                {typeof item === "object" && item !== null ? (
                  <ChangeSummaryRenderer data={item} level={level + 1} />
                ) : (
                  <span className="text-xs text-gray-600">{String(item)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // For larger arrays, show preview
      return (
        <div>
          <span className="text-xs text-gray-600">{data.length} items</span>
          <div className="text-xs text-gray-500 pl-2 mt-1 space-y-1">
            {data.slice(0, 2).map((item, index) => (
              <div key={index} className="truncate max-w-xs">
                •{" "}
                {typeof item === "object" && item !== null
                  ? JSON.stringify(item).slice(0, 30) + "..."
                  : String(item).slice(0, 30)}
              </div>
            ))}
            {data.length > 2 && (
              <div className="text-gray-400">
                ...and {data.length - 2} more items
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      return <span className="text-xs text-gray-500">No changes recorded</span>;
    }

    return (
      <div className="space-y-2">
        {entries.map(([key, value]: [string, any], index) => {
          let icon = <Activity className="text-indigo-600" size={12} />;
          let iconBg = "bg-indigo-100";
          let formattedValue = value;
          let valueComponent = null;

          // Special formatting for different types of changes
          if (
            key.toLowerCase().includes("added") ||
            key.toLowerCase().includes("add") ||
            key.toLowerCase().includes("created")
          ) {
            icon = <Plus className="text-green-600" size={12} />;
            iconBg = "bg-green-100";
          } else if (
            key.toLowerCase().includes("removed") ||
            key.toLowerCase().includes("delete") ||
            key.toLowerCase().includes("removed")
          ) {
            icon = <Minus className="text-red-600" size={12} />;
            iconBg = "bg-red-100";
          } else if (
            key.toLowerCase().includes("modified") ||
            key.toLowerCase().includes("edit") ||
            key.toLowerCase().includes("updated") ||
            key.toLowerCase().includes("corrected")
          ) {
            icon = <Edit3 className="text-orange-600" size={12} />;
            iconBg = "bg-orange-100";
          } else if (
            key.toLowerCase().includes("count") ||
            key.toLowerCase().includes("total")
          ) {
            icon = <Hash className="text-blue-600" size={12} />;
            iconBg = "bg-blue-100";
          }

          // Format different value types
          if (typeof value === "number") {
            formattedValue =
              key.toLowerCase().includes("charge") ||
              key.toLowerCase().includes("amount") ||
              key.toLowerCase().includes("price")
                ? `$${value.toFixed(2)}`
                : value.toString();
          } else if (Array.isArray(value)) {
            formattedValue = `${value.length} item${
              value.length !== 1 ? "s" : ""
            }`;
            if (value.length > 0 && typeof value[0] === "string") {
              valueComponent = (
                <div className="mt-1 pl-4 space-y-1">
                  {value.slice(0, 3).map((item: string, idx: number) => (
                    <div key={idx} className="text-xs text-gray-600">
                      • {item}
                    </div>
                  ))}
                  {value.length > 3 && (
                    <div className="text-xs text-gray-500">
                      ...and {value.length - 3} more
                    </div>
                  )}
                </div>
              );
            }
          } else if (typeof value === "object" && value !== null) {
            // For nested objects, show them in a structured way
            if (level === 0) {
              // Top level nested object - show key with expandable content
              return (
                <div key={index} className="border-l-2 border-gray-200 pl-3">
                  <details className="group">
                    <summary className="cursor-pointer flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${iconBg}`}
                      >
                        {icon}
                      </div>
                      <span className="text-xs font-medium text-gray-700 capitalize">
                        {key
                          .replace(/_/g, " ")
                          .replace(/([A-Z])/g, " $1")
                          .toLowerCase()}
                        <span className="ml-1 text-xs text-gray-500">
                          ({Object.keys(value).length} details)
                        </span>
                      </span>
                      <svg
                        className="w-3 h-3 ml-auto transition-transform group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </summary>
                    <div className="mt-2 ml-6">
                      <ChangeSummaryRenderer data={value} level={level + 1} />
                    </div>
                  </details>
                </div>
              );
            } else {
              formattedValue = `${Object.keys(value).length} properties`;
            }
          }

          return (
            <div key={index} className="flex items-start gap-2 text-xs">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${iconBg}`}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-700 capitalize">
                    {key
                      .replace(/_/g, " ")
                      .replace(/([A-Z])/g, " $1")
                      .toLowerCase()}
                    :
                  </span>
                  <span className="text-gray-600">{formattedValue}</span>
                </div>
                {valueComponent}
                {typeof value === "object" &&
                  !Array.isArray(value) &&
                  level > 0 && (
                    <div className="mt-1 ml-4">
                      <ChangeSummaryRenderer data={value} level={level + 1} />
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-xs text-gray-600">{String(data)}</span>;
};

// @ts-ignore
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface HistoryEntry {
  history_id: string;
  file_id: string;
  version: number;
  change_type: string;
  change_description: string;
  changes_summary?: any;
  changed_by: string;
  changed_by_username: string;
  changed_via: string;
  changed_at: string;
  previous_value_size?: number;
  new_value_size?: number;
  correction_log_ids?: string[];
  related_validation_ids?: string[];
  previous_value?: any;
  new_value?: any;
}

interface HistoryResponse {
  fileId: string;
  fileName: string;
  currentVersion: number;
  totalChanges: number;
  history: HistoryEntry[];
}

// Structured display components
const ClaimSummary: React.FC<{ data: any }> = ({ data }) => {
  const isa = data.isa;
  const gs = data.gs;
  const claims = data.claims?.[0]?.claims || [];

  const totalCharges = claims.reduce(
    (sum: number, claim: any) => sum + (parseFloat(claim.totalCharge) || 0),
    0
  );

  return (
    <div className="card p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="text-green-600" size={20} />
        <h3 className="text-lg font-semibold text-green-900">
          837 File Summary
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {claims.length}
          </div>
          <div className="text-sm text-gray-600">Claims</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            ${totalCharges.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Total Charges</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {isa?.interchangeControlNumber || "N/A"}
          </div>
          <div className="text-sm text-gray-600">ISA Control #</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {gs?.groupControlNumber || "N/A"}
          </div>
          <div className="text-sm text-gray-600">GS Control #</div>
        </div>
      </div>
    </div>
  );
};

const ServiceLinesTable: React.FC<{
  serviceLines: any[];
  diagnoses?: any[];
}> = ({ serviceLines, diagnoses }) => {
  if (!serviceLines || serviceLines.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Service Lines</h3>
        </div>
        <p className="text-gray-500 text-sm">No service lines found</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold text-gray-900">
          Service Lines ({serviceLines.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Procedure
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Revenue
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Units
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Charge
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Dx Pointer
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {serviceLines.map((line: any, index: number) => (
              <tr key={index}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {line.procedureCode || "N/A"}
                    </div>
                    {line.serviceLineType === "SV2" && (
                      <div className="text-xs text-gray-500">Institutional</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {line.revenueCode || "N/A"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {line.serviceUnitCount || 0}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-green-600">
                  ${(line.lineItemCharge || 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="space-y-1">
                    <div>{line.serviceDateFrom || "N/A"}</div>
                    {line.serviceDateTo &&
                      line.serviceDateTo !== line.serviceDateFrom && (
                        <div className="text-xs">to {line.serviceDateTo}</div>
                      )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {line.diagnosisCodePointer || "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diagnoses && diagnoses.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Diagnosis Codes
          </h4>
          <div className="flex flex-wrap gap-2">
            {diagnoses.map((dx: any, index: number) => (
              <span
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                  index === 0
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {dx.code} {index === 0 && "(Principal)"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PatientInfo: React.FC<{ data: any }> = ({ data }) => {
  const patient = data.patient;
  const subscriber = data.subscriber;
  const subscriberInfo = data.subscriberInfo;

  if (!patient && !subscriber) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="text-pink-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">
            Patient Information
          </h3>
        </div>
        <p className="text-gray-500 text-sm">
          No patient information available
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="text-pink-600" size={20} />
        <h3 className="text-lg font-semibold text-gray-900">
          Patient Information
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {patient && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Patient Details</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {patient.firstName}{" "}
                {patient.lastName}
              </div>
              <div>
                <span className="font-medium">DOB:</span>{" "}
                {patient.dateOfBirth || "N/A"}
              </div>
              <div>
                <span className="font-medium">Gender:</span>{" "}
                {patient.gender || "N/A"}
              </div>
              {patient.address && (
                <div>
                  <span className="font-medium">Address:</span>
                  <br />
                  {patient.address.addressLine1 || patient.addressLine1}
                  <br />
                  {patient.city}, {patient.state} {patient.zipCode}
                </div>
              )}
            </div>
          </div>
        )}

        {subscriber && subscriberInfo && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">
              Subscriber Details
              <span className="ml-2 text-xs text-gray-500">
                ({subscriberInfo.relationshipDescription})
              </span>
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span>{" "}
                {subscriber.firstName} {subscriber.lastName}
              </div>
              <div>
                <span className="font-medium">Group:</span>{" "}
                {subscriberInfo.groupNumber || "N/A"}
              </div>
              <div>
                <span className="font-medium">Insurance:</span>{" "}
                {subscriberInfo.claimFilingIndicatorCode || "N/A"}
              </div>
              <div>
                <span className="font-medium">Payer Resp:</span>{" "}
                {subscriberInfo.payerResponsibilitySequence}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProviderInfo: React.FC<{ data: any }> = ({ data }) => {
  const billing = data.billing;
  const rendering = data.renderingProvider;
  const serviceFacility = data.serviceFacility;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Building className="text-indigo-600" size={20} />
        <h3 className="text-lg font-semibold text-gray-900">
          Providers & Facilities
        </h3>
      </div>

      <div className="space-y-4">
        {billing && (
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-gray-900">Billing Provider</h4>
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <div>
                {billing.firstName} {billing.lastName}
              </div>
              {billing.identificationCode && (
                <div>
                  <span className="font-medium">NPI:</span>{" "}
                  {billing.identificationCode}
                </div>
              )}
              {billing.taxId && (
                <div>
                  <span className="font-medium">Tax ID:</span> {billing.taxId}
                </div>
              )}
              {billing.address && (
                <div>
                  {billing.address.addressLine1}, {billing.address.city},{" "}
                  {billing.address.state}
                </div>
              )}
            </div>
          </div>
        )}

        {rendering && (
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-medium text-gray-900">Rendering Provider</h4>
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <div>
                {rendering.firstName} {rendering.lastName}
              </div>
              {rendering.identificationCode && (
                <div>
                  <span className="font-medium">NPI:</span>{" "}
                  {rendering.identificationCode}
                </div>
              )}
              {rendering.providerInfo && (
                <div>
                  <span className="font-medium">Taxonomy:</span>{" "}
                  {rendering.providerInfo.providerTaxonomyCode}
                </div>
              )}
            </div>
          </div>
        )}

        {serviceFacility && (
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-medium text-gray-900">Service Facility</h4>
            <div className="mt-2 text-sm text-gray-700">
              <div>
                {serviceFacility.firstName} {serviceFacility.lastName}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ParsedJsonHistory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get("fileId");

  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionDetails, setVersionDetails] = useState<any>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"summary" | "details" | "raw">("summary");

  useEffect(() => {
    if (fileId) {
      fetchHistory();
    } else {
      setError("No file ID provided");
      setLoading(false);
    }
  }, [fileId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/upload/${fileId}/parsed-json-history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setHistoryData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch history");
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionDetails = async (version: number) => {
    try {
      setLoadingVersion(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/upload/${fileId}/parsed-json-history/${version}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setVersionDetails(response.data);
      setSelectedVersion(version);
    } catch (err: any) {
      console.error("Error fetching version details:", err);
      alert("Failed to load version details");
    } finally {
      setLoadingVersion(false);
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case "INITIAL_PARSE":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "AUTO_CORRECTION":
        return "bg-green-100 text-green-700 border-green-200";
      case "MANUAL_EDIT":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "REGENERATION":
        return "bg-purple-100 text-purple-700 border-purple-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case "INITIAL_PARSE":
        return <FileJson className="text-blue-600" size={18} />;
      case "AUTO_CORRECTION":
        return <CheckCircle className="text-green-600" size={18} />;
      case "MANUAL_EDIT":
        return <User className="text-yellow-600" size={18} />;
      case "REGENERATION":
        return <RefreshCw className="text-purple-600" size={18} />;
      default:
        return <Code className="text-gray-600" size={18} />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Calculate change statistics from previous_value and new_value
  const calculateChangeStats = (previousValue: any, newValue: any) => {
    if (!previousValue || !newValue) return null;

    const flattenObject = (obj: any, prefix: string = ""): Array<{ path: string; value: any }> => {
      const result: Array<{ path: string; value: any }> = [];
      if (obj === null || obj === undefined) {
        result.push({ path: prefix, value: obj });
        return result;
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          const path = prefix ? `${prefix}[${index}]` : `[${index}]`;
          if (typeof item === "object" && item !== null) {
            result.push(...flattenObject(item, path));
          } else {
            result.push({ path, value: item });
          }
        });
        return result;
      }
      if (typeof obj === "object") {
        Object.entries(obj).forEach(([key, value]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          if (typeof value === "object" && value !== null) {
            result.push(...flattenObject(value, path));
          } else {
            result.push({ path, value });
          }
        });
        return result;
      }
      result.push({ path: prefix, value: obj });
      return result;
    };

    const prevFlattened = flattenObject(previousValue);
    const newFlattened = flattenObject(newValue);

    const allPaths = new Set([
      ...prevFlattened.map((p) => p.path),
      ...newFlattened.map((p) => p.path),
    ]);

    let modified = 0;
    let added = 0;
    let removed = 0;

    allPaths.forEach((path) => {
      const prevItem = prevFlattened.find((p) => p.path === path);
      const newItem = newFlattened.find((p) => p.path === path);

      if (prevItem && newItem) {
        if (String(prevItem.value) !== String(newItem.value)) {
          modified++;
        }
      } else if (!prevItem && newItem) {
        added++;
      } else if (prevItem && !newItem) {
        removed++;
      }
    });

    return { modified, added, removed, total: modified + added + removed };
  };

  // Filter and search logic
  const filteredHistory = historyData?.history.filter((entry) => {
    // Filter by type
    if (filterType !== "ALL" && entry.change_type !== filterType) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.change_description.toLowerCase().includes(query) ||
        entry.change_type.toLowerCase().includes(query) ||
        entry.changed_by_username.toLowerCase().includes(query) ||
        JSON.stringify(entry.changes_summary || {}).toLowerCase().includes(query)
      );
    }

    return true;
  }) || [];

  if (!fileId) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="card p-8 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-red-600" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-1">
                Missing File ID
              </h3>
              <p className="text-red-700 mb-4">
                No file ID was provided in the URL.
              </p>
              <button
                onClick={() => navigate("/upload-history")}
                className="btn-secondary"
              >
                <ArrowLeft size={18} />
                Back to Upload History
              </button>
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
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={() => navigate("/upload/history")}
            className="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <GitBranch className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Claim Correction History
            </h1>
            {historyData && (
              <p className="text-gray-600 mt-1">
                {historyData.fileName} - Version {historyData.currentVersion} (
                {historyData.totalChanges} changes)
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading history...</p>
        </div>
      ) : error ? (
        <div className="card p-8 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200">
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
      ) : historyData && historyData.history.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Code className="text-gray-400" size={36} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Parsing History Yet
          </h3>
          <p className="text-gray-600 mb-4">
            This claim file hasn't been modified since initial parsing.
          </p>
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
            <strong>Tip:</strong> Utilize the claim validation features to
            trigger automatic corrections or manual edits that will appear here.
          </div>
        </div>
      ) : (
        <div className="card shadow-lg border border-gray-200">
          {/* Filter and Search Bar */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Filter Dropdown */}
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Filter by Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="ALL">All Changes</option>
                  <option value="INITIAL_PARSE">Initial Parse</option>
                  <option value="AUTO_CORRECTION">Auto Correction</option>
                  <option value="MANUAL_EDIT">Manual Edit</option>
                  <option value="REGENERATION">Regeneration</option>
                </select>
              </div>

              {/* Search Input */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Search History
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by description, user, or change details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Results Count */}
              <div className="flex items-end">
                <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                  {filteredHistory.length} of {historyData?.history.length || 0} results
                </div>
              </div>
            </div>

            {/* Active Filters Display */}
            {(filterType !== "ALL" || searchQuery) && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">Active filters:</span>
                {filterType !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">
                    Type: {filterType.replace(/_/g, " ")}
                    <button
                      onClick={() => setFilterType("ALL")}
                      className="hover:text-purple-900"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs">
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery("")}
                      className="hover:text-purple-900"
                    >
                      ✕
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setFilterType("ALL");
                    setSearchQuery("");
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="p-6">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="text-gray-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Results Found
                </h3>
                <p className="text-gray-600 mb-4">
                  No history entries match your current filters.
                </p>
                <button
                  onClick={() => {
                    setFilterType("ALL");
                    setSearchQuery("");
                  }}
                  className="btn-secondary"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map((entry, index) => (
                <div
                  key={entry.history_id}
                  className="relative flex gap-4 pb-4"
                  style={{
                    borderLeft:
                      index < filteredHistory.length - 1
                        ? "2px solid #e5e7eb"
                        : "none",
                    marginLeft: "1rem",
                    paddingLeft: "2rem",
                  }}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-2 w-8 h-8 -ml-4 bg-white rounded-full border-4 border-purple-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-purple-600">
                      {entry.version}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Change Type Badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getChangeTypeColor(
                              entry.change_type
                            )}`}
                          >
                            {getChangeTypeIcon(entry.change_type)}
                            {entry.change_type.replace(/_/g, " ")}
                          </span>
                          {historyData && entry.version === historyData.currentVersion && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                              Current
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {entry.change_description}
                        </p>

                        {/* Change Statistics Badges */}
                        {entry.previous_value && entry.new_value && (() => {
                          const stats = calculateChangeStats(entry.previous_value, entry.new_value);
                          return stats && stats.total > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-600">Changes:</span>
                              {stats.modified > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-medium">
                                  <Edit3 size={10} />
                                  {stats.modified} Modified
                                </span>
                              )}
                              {stats.added > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
                                  <Plus size={10} />
                                  {stats.added} Added
                                </span>
                              )}
                              {stats.removed > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-medium">
                                  <Minus size={10} />
                                  {stats.removed} Removed
                                </span>
                              )}
                              <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                                Total: {stats.total} field{stats.total !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ) : null;
                        })()}

                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatDate(entry.changed_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            {entry.changed_by_username}
                          </div>
                          <div className="flex items-center gap-1">
                            <Code size={14} />
                            via {entry.changed_via}
                          </div>
                          {entry.new_value_size && (
                            <div className="text-gray-500">
                              Size: {formatBytes(entry.new_value_size)}
                            </div>
                          )}
                        </div>

                        {/* Enhanced Change Summary if available */}
                        {entry.changes_summary && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="text-indigo-600" size={14} />
                              <p className="text-xs font-semibold text-indigo-700">
                                Change Summary
                              </p>
                            </div>
                            <ChangeSummaryDisplay
                              summary={entry.changes_summary}
                            />
                          </div>
                        )}

                        {/* Before/After Data Changes - For Auto and Manual Corrections */}
                        {(entry.change_type === "AUTO_CORRECTION" ||
                          entry.change_type === "MANUAL_EDIT") &&
                          entry.previous_value &&
                          entry.new_value && (
                            <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                              <div className="flex items-center gap-2 mb-2">
                                <ArrowLeft
                                  className="text-purple-600"
                                  size={14}
                                />
                                <p className="text-xs font-semibold text-purple-700">
                                  {entry.change_type === "AUTO_CORRECTION"
                                    ? "Auto-Correction Details (Before → After)"
                                    : "Manual Correction Details (Before → After)"}
                                </p>
                                <ArrowLeft
                                  className="text-pink-600 transform rotate-180"
                                  size={14}
                                />
                              </div>
                              <DataChangesDisplay
                                previousValue={entry.previous_value}
                                newValue={entry.new_value}
                              />
                            </div>
                          )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => fetchVersionDetails(entry.version)}
                          disabled={
                            loadingVersion && selectedVersion === entry.version
                          }
                          className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          {loadingVersion &&
                          selectedVersion === entry.version ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Eye size={16} />
                          )}
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Version Details Modal */}
      {versionDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Version {versionDetails.version} Details
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {versionDetails.file_name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedVersion(null);
                    setVersionDetails(null);
                  }}
                  className="w-10 h-10 bg-white rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-white">
              <div className="flex px-6">
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "summary"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setActiveTab("details")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "details"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Claim Details
                </button>
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "raw"
                      ? "border-purple-600 text-purple-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Raw JSON
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Summary Tab */}
              {activeTab === "summary" && (
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card p-4">
                    <p className="text-xs text-gray-600 mb-1">Version</p>
                    <p className="text-lg font-bold text-gray-900">
                      {versionDetails.version}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-gray-600 mb-1">Changed By</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {versionDetails.changed_by_username}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-gray-600 mb-1">Changed At</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(versionDetails.changed_at)}
                    </p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-gray-600 mb-1">Change Type</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {versionDetails.change_type}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="card p-4 bg-blue-50 border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    Description
                  </p>
                  <p className="text-sm text-blue-800">
                    {versionDetails.change_description}
                  </p>
                </div>

                {/* Structured Data Display */}
                {versionDetails.new_value && (
                  <>
                    <ClaimSummary data={versionDetails.new_value} />

                    {versionDetails.new_value.claims?.[0] && (
                      <>
                        <PatientInfo
                          data={versionDetails.new_value.claims[0]}
                        />
                        <ProviderInfo
                          data={versionDetails.new_value.claims[0]}
                        />
                        <ServiceLinesTable
                          serviceLines={
                            versionDetails.new_value.claims[0].claims?.[0]
                              ?.serviceLines || []
                          }
                          diagnoses={
                            versionDetails.new_value.claims[0].claims?.[0]
                              ?.diagnoses || []
                          }
                        />
                      </>
                    )}
                  </>
                )}

                </div>
              )}

              {/* Details Tab */}
              {activeTab === "details" && versionDetails.new_value && (
                <div className="space-y-6">
                  <ClaimSummary data={versionDetails.new_value} />

                  {versionDetails.new_value.claims?.[0] && (
                    <>
                      <PatientInfo
                        data={versionDetails.new_value.claims[0]}
                      />
                      <ProviderInfo
                        data={versionDetails.new_value.claims[0]}
                      />
                      <ServiceLinesTable
                        serviceLines={
                          versionDetails.new_value.claims[0].claims?.[0]
                            ?.serviceLines || []
                        }
                        diagnoses={
                          versionDetails.new_value.claims[0].claims?.[0]
                            ?.diagnoses || []
                        }
                      />
                    </>
                  )}
                </div>
              )}

              {/* Raw JSON Tab */}
              {activeTab === "raw" && (
                <div>
                  {versionDetails.previous_value && versionDetails.new_value ? (
                    // Side-by-side comparison when both values exist
                    <div>
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900 font-medium">
                          Side-by-side JSON comparison with synchronized scrolling. Lines highlighted in color indicate differences.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Previous Value JSON */}
                        <div className="card p-4 bg-red-50 border-red-200">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <p className="text-sm font-semibold text-red-900">
                              Previous Value (Before)
                            </p>
                          </div>
                          <div
                            className="bg-gray-900 p-4 rounded-lg overflow-auto text-xs max-h-[600px]"
                            onScroll={(e) => {
                              const target = e.currentTarget;
                              const newValueElement = target.parentElement?.parentElement?.querySelector('.new-value-json');
                              if (newValueElement) {
                                newValueElement.scrollTop = target.scrollTop;
                                newValueElement.scrollLeft = target.scrollLeft;
                              }
                            }}
                          >
                            {(() => {
                              const prevLines = JSON.stringify(versionDetails.previous_value, null, 2).split('\n');
                              const newLines = JSON.stringify(versionDetails.new_value, null, 2).split('\n');

                              return (
                                <pre className="m-0">
                                  {prevLines.map((line, index) => {
                                    const isDifferent = newLines[index] !== line;
                                    return (
                                      <div
                                        key={index}
                                        className={`${isDifferent ? 'bg-red-900/40 text-red-200' : 'text-gray-300'}`}
                                        style={{ minHeight: '1.25rem' }}
                                      >
                                        {line || ' '}
                                      </div>
                                    );
                                  })}
                                </pre>
                              );
                            })()}
                          </div>
                        </div>

                        {/* New Value JSON */}
                        <div className="card p-4 bg-green-50 border-green-200">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <p className="text-sm font-semibold text-green-900">
                              New Value (After)
                            </p>
                          </div>
                          <div
                            className="bg-gray-900 p-4 rounded-lg overflow-auto text-xs max-h-[600px] new-value-json"
                            onScroll={(e) => {
                              const target = e.currentTarget;
                              const prevValueElement = target.parentElement?.parentElement?.previousElementSibling?.querySelector('div[onScroll]');
                              if (prevValueElement) {
                                prevValueElement.scrollTop = target.scrollTop;
                                prevValueElement.scrollLeft = target.scrollLeft;
                              }
                            }}
                          >
                            {(() => {
                              const prevLines = JSON.stringify(versionDetails.previous_value, null, 2).split('\n');
                              const newLines = JSON.stringify(versionDetails.new_value, null, 2).split('\n');

                              return (
                                <pre className="m-0">
                                  {newLines.map((line, index) => {
                                    const isDifferent = prevLines[index] !== line;
                                    return (
                                      <div
                                        key={index}
                                        className={`${isDifferent ? 'bg-green-900/40 text-green-200' : 'text-gray-300'}`}
                                        style={{ minHeight: '1.25rem' }}
                                      >
                                        {line || ' '}
                                      </div>
                                    );
                                  })}
                                </pre>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Single value display when only one exists
                    <div className="space-y-4">
                      {versionDetails.new_value && (
                        <div className="card p-4">
                          <p className="text-sm font-semibold text-gray-900 mb-3">
                            New Value (JSON)
                          </p>
                          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                            {JSON.stringify(
                              versionDetails.new_value,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}

                      {versionDetails.previous_value && (
                        <div className="card p-4">
                          <p className="text-sm font-semibold text-gray-900 mb-3">
                            Previous Value (JSON)
                          </p>
                          <pre className="bg-gray-900 text-yellow-400 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                            {JSON.stringify(
                              versionDetails.previous_value,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setSelectedVersion(null);
                  setVersionDetails(null);
                }}
                className="btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParsedJsonHistory;
