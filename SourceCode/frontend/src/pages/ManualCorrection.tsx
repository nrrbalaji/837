import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  List,
  Lightbulb,
  RotateCcw,
  Search,
  Info,
} from "lucide-react";
import Editor, { Monaco } from "@monaco-editor/react";
import type * as monacoType from "monaco-editor";
import ErrorNavigationPanel from "../components/ErrorNavigationPanel";
import QuickFixSuggestion from "../components/QuickFixSuggestion";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface FileDetail {
  file_id: string;
  file_name: string;
  parsed_json: any;
}

interface ValidationError {
  validation_id: string;
  segment_id?: string;
  element_id?: string;
  validation_rule?: string;
  error_message: string;
  error_location: string;
  severity: "ERROR" | "WARNING" | "INFO";
  validated_at: string;
}

interface ValidationErrors {
  ediErrors: ValidationError[];
  fileErrors: ValidationError[];
  totalErrors: number;
}

const ManualCorrection: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileId = searchParams.get("fileId");

  const [fileDetail, setFileDetail] = useState<FileDetail | null>(null);
  const [jsonContent, setJsonContent] = useState<string>("");
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(
    null
  );
  const monacoRef = useRef<Monaco | null>(null);

  useEffect(() => {
    if (fileId) {
      fetchFileDetail();
      fetchValidationErrors();
    }
  }, [fileId]);

  const fetchFileDetail = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const response = await axios.get(
        `${API_BASE}/files/${fileId}/parsed-json`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setFileDetail(response.data);
      setJsonContent(JSON.stringify(response.data.parsed_json, null, 2));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch file details");
      console.error("Error fetching file detail:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationErrors = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/files/${fileId}/validation-errors`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setValidationErrors(response.data);
    } catch (err: any) {
      console.error("Error fetching validation errors:", err);
    }
  };

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      setJsonError(null);
      return true;
    } catch (err: any) {
      setJsonError(`Invalid JSON: ${err.message}`);
      return false;
    }
  };

  const handleEditorDidMount = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Apply validation error decorations
    if (validationErrors) {
      applyErrorDecorations(editor, monaco, validationErrors);
    }
  };

  const applyErrorDecorations = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: Monaco,
    errors: ValidationErrors
  ) => {
    const decorations: monacoType.editor.IModelDeltaDecoration[] = [];
    const markers: monacoType.editor.IMarkerData[] = [];

    try {
      const jsonObj = JSON.parse(jsonContent);

      // Process EDI errors
      errors.ediErrors.forEach((error) => {
        const pathInfo = findJsonPath(
          jsonObj,
          error.segment_id || error.error_location
        );
        if (pathInfo) {
          const { line, column, endColumn } = pathInfo;

          // Add decoration
          decorations.push({
            range: new monaco.Range(line, column, line, endColumn),
            options: {
              inlineClassName:
                error.severity === "ERROR"
                  ? "monaco-error-decoration"
                  : "monaco-warning-decoration",
              glyphMarginClassName:
                error.severity === "ERROR"
                  ? "monaco-error-glyph"
                  : "monaco-warning-glyph",
              hoverMessage: {
                value: `**${error.severity}**: ${error.error_message}\n\n_Location: ${error.error_location}_`,
              },
            },
          });

          // Add marker
          markers.push({
            severity:
              error.severity === "ERROR"
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
            message: error.error_message,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: endColumn,
          });
        }
      });

      // Process file errors
      errors.fileErrors.forEach((error) => {
        const pathInfo = findJsonPath(jsonObj, error.error_location);
        if (pathInfo) {
          const { line, column, endColumn } = pathInfo;

          decorations.push({
            range: new monaco.Range(line, column, line, endColumn),
            options: {
              inlineClassName:
                error.severity === "ERROR"
                  ? "monaco-error-decoration"
                  : "monaco-warning-decoration",
              glyphMarginClassName:
                error.severity === "ERROR"
                  ? "monaco-error-glyph"
                  : "monaco-warning-glyph",
              hoverMessage: {
                value: `**${error.severity}**: ${error.error_message}`,
              },
            },
          });

          markers.push({
            severity:
              error.severity === "ERROR"
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
            message: error.error_message,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: endColumn,
          });
        }
      });

      // Apply decorations
      editor.deltaDecorations([], decorations);

      // Set markers
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, "validationErrors", markers);
      }
    } catch (err) {
      console.error("Error applying decorations:", err);
    }
  };

  // Helper function to find JSON path and line number with improved accuracy
  const findJsonPath = (
    obj: any,
    searchKey: string
  ): { line: number; column: number; endColumn: number } | null => {
    const lines = jsonContent.split("\n");

    // Extract segment type and element info from searchKey
    // Examples: "ISA", "GS.01", "ST.02", "NM1.09", "CLM.01"
    const segmentMatch = searchKey.match(/^([A-Z0-9]+)(?:\.(\d+))?/);
    const segment = segmentMatch ? segmentMatch[1] : searchKey;
    const element = segmentMatch ? segmentMatch[2] : null;

    // Try to find the segment in the JSON structure
    // Look for patterns like: "isa": {, "gs": {, "st": {, "claims": [
    const segmentLower = segment.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Match segment objects like "isa": {, "gs": {, etc.
      if (trimmedLine.includes(`"${segmentLower}":`)) {
        const column = line.indexOf(`"${segmentLower}"`);
        return {
          line: i + 1,
          column: column + 1,
          endColumn: column + segmentLower.length + 4,
        };
      }

      // For array elements within segments, look for specific fields
      if (element && line.includes(segmentLower)) {
        // Found the segment area, now look for the element
        for (let j = i; j < Math.min(i + 50, lines.length); j++) {
          const elemLine = lines[j];
          // Look for element patterns that might match
          if (elemLine.includes('"') && j > i) {
            const column = elemLine.indexOf('"');
            return {
              line: j + 1,
              column: column + 1,
              endColumn: column + 20,
            };
          }
        }
        // Return segment location if element not found
        const column = line.indexOf(segmentLower);
        return {
          line: i + 1,
          column: column + 1,
          endColumn: column + segmentLower.length + 3,
        };
      }

      // Fallback: search for the exact key or value
      if (line.includes(searchKey) || line.includes(`"${searchKey}"`)) {
        const column =
          line.indexOf(searchKey) >= 0
            ? line.indexOf(searchKey)
            : line.indexOf(`"${searchKey}"`);
        if (column >= 0) {
          return {
            line: i + 1,
            column: column + 1,
            endColumn: column + searchKey.length + 3,
          };
        }
      }
    }

    return null;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setJsonContent(value);
      setSaveSuccess(false);

      // Validate JSON on change
      if (value.trim()) {
        validateJson(value);
      }
    }
  };

  const handleSave = async () => {
    if (!validateJson(jsonContent)) {
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const parsedJson = JSON.parse(jsonContent);

      await axios.put(
        `${API_BASE}/files/${fileId}/parsed-json`,
        { parsed_json: parsedJson },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSaveSuccess(true);
      setError(null);

      // Refresh validation errors after save
      await fetchValidationErrors();

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save changes");
      setSaveSuccess(false);
      console.error("Error saving changes:", err);
    } finally {
      setSaving(false);
    }
  };

  const formatJson = () => {
    if (validateJson(jsonContent)) {
      const parsed = JSON.parse(jsonContent);
      setJsonContent(JSON.stringify(parsed, null, 2));
    }
  };

  if (!fileId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="text-yellow-600" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-1">
                Missing File ID
              </h3>
              <p className="text-yellow-800">
                Please provide a fileId parameter to perform manual corrections.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Add Monaco Editor CSS */}
      <style>{`
        .monaco-error-decoration {
          background-color: rgba(255, 0, 0, 0.15);
          border-bottom: 2px wavy #ff0000;
        }
        .monaco-warning-decoration {
          background-color: rgba(255, 165, 0, 0.10);
          border-bottom: 2px wavy #ffa500;
        }
        .monaco-error-glyph {
          background: #ff0000;
          width: 16px !important;
          height: 16px;
          border-radius: 50%;
          margin-left: 3px;
        }
        .monaco-warning-glyph {
          background: #ffa500;
          width: 16px !important;
          height: 16px;
          border-radius: 50%;
          margin-left: 3px;
        }
      `}</style>

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Validation Logs
        </button>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Manual Correction
              </h1>
              <p className="text-gray-600 mt-1">
                Edit parsed claim data for file{" "}
                {fileDetail?.file_name || fileId}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !!jsonError || !jsonContent.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={20} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Validation Error Summary */}
      {validationErrors && validationErrors.totalErrors > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg shadow-md">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-red-600" size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                {validationErrors.totalErrors} Validation Error
                {validationErrors.totalErrors > 1 ? "s" : ""} Found
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-red-700">EDI Errors:</span>
                  <span className="ml-2 text-red-600">
                    {validationErrors.ediErrors.length}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-red-700">File Errors:</span>
                  <span className="ml-2 text-red-600">
                    {validationErrors.fileErrors.length}
                  </span>
                </div>
              </div>
              <p className="text-red-700 text-sm mt-2">
                Errors are highlighted in the editor below. Hover over
                highlighted fields for details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900">
                Changes Saved Successfully
              </h3>
              <p className="text-green-700 text-sm">
                The parsed JSON data has been updated and 837 file regeneration
                started.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-lg shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="text-red-600" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* JSON Editor */}
      <div className="card shadow-lg border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading file data...</p>
          </div>
        ) : (
          <div>
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Monaco JSON Editor
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Edit the JSON data below. Validation errors are highlighted
                    with red (ERROR) and yellow (WARNING) decorations.
                  </p>
                </div>
                <button
                  onClick={formatJson}
                  className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  Format JSON
                </button>
              </div>
              {jsonError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    {jsonError}
                  </p>
                </div>
              )}
            </div>
            <div className="h-[700px] border-b border-gray-200">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={jsonContent}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                theme="vs"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                  wrappingIndent: "indent",
                  formatOnPaste: true,
                  formatOnType: true,
                  glyphMargin: true,
                }}
              />
            </div>
            <div className="p-6 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span className="font-medium">File ID:</span> {fileId}
                {validationErrors && validationErrors.totalErrors > 0 && (
                  <span className="ml-4">
                    <span className="font-medium">Errors:</span>
                    <span className="ml-1 text-red-600">
                      {validationErrors.totalErrors}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !!jsonError || !jsonContent.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualCorrection;
