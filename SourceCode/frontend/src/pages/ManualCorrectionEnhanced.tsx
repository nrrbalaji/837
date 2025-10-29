import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  List,
  Lightbulb,
  RotateCcw,
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
  line?: number;
}

interface ValidationErrors {
  ediErrors: ValidationError[];
  fileErrors: ValidationError[];
  totalErrors: number;
}

interface FixSuggestion {
  type: "STATIC" | "MASTER_LOOKUP" | "FORMAT" | "CALCULATION";
  description: string;
  suggestedValue?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  source?: string;
}

const ManualCorrection: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileId = searchParams.get("fileId");

  // State
  const [fileDetail, setFileDetail] = useState<FileDetail | null>(null);
  const [jsonContent, setJsonContent] = useState<string>("");
  const [originalJsonContent, setOriginalJsonContent] = useState<string>("");
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // UI State
  const [showErrorPanel, setShowErrorPanel] = useState(true);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(-1);
  const [selectedError, setSelectedError] = useState<ValidationError | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<FixSuggestion[]>([]);

  // Refs
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(
    null
  );
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Calculate progress
  const allErrors = validationErrors
    ? [...validationErrors.ediErrors, ...validationErrors.fileErrors]
    : [];
  const totalErrors = allErrors.length;
  const errorProgress =
    totalErrors > 0 ? ((currentErrorIndex + 1) / totalErrors) * 100 : 0;

  useEffect(() => {
    if (fileId) {
      fetchFileDetail();
      fetchValidationErrors();
    }
  }, [fileId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // F8 for next error
      if (e.key === "F8" && !e.shiftKey) {
        e.preventDefault();
        navigateToNextError();
      }
      // Shift+F8 for previous error
      if (e.key === "F8" && e.shiftKey) {
        e.preventDefault();
        navigateToPreviousError();
      }
      // Escape to close panels
      if (e.key === "Escape") {
        setShowHelpPanel(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentErrorIndex, totalErrors, hasUnsavedChanges]);

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
      const formattedJson = JSON.stringify(response.data.parsed_json, null, 2);
      setJsonContent(formattedJson);
      setOriginalJsonContent(formattedJson);
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

      // Process all errors
      [...errors.ediErrors, ...errors.fileErrors].forEach((error) => {
        const pathInfo = findJsonPath(
          jsonObj,
          error.segment_id || error.error_location
        );
        if (pathInfo) {
          const { line, column, endColumn } = pathInfo;
          error.line = line;

          // Add decoration
          decorations.push({
            range: new monaco.Range(line, column, line, endColumn),
            options: {
              inlineClassName:
                error.severity === "ERROR"
                  ? "monaco-error-decoration"
                  : error.severity === "WARNING"
                  ? "monaco-warning-decoration"
                  : "monaco-info-decoration",
              glyphMarginClassName:
                error.severity === "ERROR"
                  ? "monaco-error-glyph"
                  : error.severity === "WARNING"
                  ? "monaco-warning-glyph"
                  : "monaco-info-glyph",
              hoverMessage: {
                value: `**${error.severity}**: ${error.error_message}\n\n_Location: ${error.error_location}_\n\n💡 Click to see suggestions`,
              },
            },
          });

          // Add marker
          markers.push({
            severity:
              error.severity === "ERROR"
                ? monaco.MarkerSeverity.Error
                : error.severity === "WARNING"
                ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Info,
            message: error.error_message,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: endColumn,
          });
        }
      });

      // Apply decorations
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        decorations
      );

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
    _obj: any,
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
      setHasUnsavedChanges(value !== originalJsonContent);

      if (value.trim()) {
        validateJson(value);
      }

      // Reapply decorations when content changes
      if (editorRef.current && monacoRef.current && validationErrors) {
        applyErrorDecorations(
          editorRef.current,
          monacoRef.current,
          validationErrors
        );
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
      setOriginalJsonContent(jsonContent);
      setHasUnsavedChanges(false);

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

  const handleRevertChanges = () => {
    if (confirm("Are you sure you want to discard all unsaved changes?")) {
      setJsonContent(originalJsonContent);
      setHasUnsavedChanges(false);
    }
  };

  const navigateToNextError = () => {
    if (allErrors.length === 0) return;
    const nextIndex = (currentErrorIndex + 1) % allErrors.length;
    setCurrentErrorIndex(nextIndex);
    jumpToError(allErrors[nextIndex]);
  };

  const navigateToPreviousError = () => {
    if (allErrors.length === 0) return;
    const prevIndex =
      currentErrorIndex <= 0 ? allErrors.length - 1 : currentErrorIndex - 1;
    setCurrentErrorIndex(prevIndex);
    jumpToError(allErrors[prevIndex]);
  };

  const jumpToError = (error: ValidationError) => {
    setSelectedError(error);
    setShowHelpPanel(true);

    // Generate suggestions for the error
    generateSuggestions(error);

    if (editorRef.current && error.line) {
      editorRef.current.revealLineInCenter(error.line);
      editorRef.current.setPosition({ lineNumber: error.line, column: 1 });
      editorRef.current.focus();
    }
  };

  const handleErrorClick = (error: ValidationError, index: number) => {
    setCurrentErrorIndex(index);
    jumpToError(error);
  };

  const generateSuggestions = (error: ValidationError) => {
    // Mock suggestions - In production, fetch from backend
    const mockSuggestions: FixSuggestion[] = [];

    if (error.segment_id === "NM1" || error.error_message.includes("NPI")) {
      mockSuggestions.push({
        type: "MASTER_LOOKUP",
        description: "Lookup correct NPI from Provider Master",
        suggestedValue: "1234567890",
        confidence: "HIGH",
        source: "Master Provider Table",
      });
    }

    if (
      error.error_message.includes("format") ||
      error.error_message.includes("length")
    ) {
      mockSuggestions.push({
        type: "FORMAT",
        description: "Apply correct formatting to meet validation requirements",
        confidence: "MEDIUM",
      });
    }

    setSuggestions(mockSuggestions);
  };

  const handleApplyFix = (suggestion: FixSuggestion) => {
    if (suggestion.suggestedValue && selectedError) {
      // In production, apply the fix to the JSON
      alert(
        `Would apply fix: ${suggestion.suggestedValue} to ${selectedError.error_location}`
      );
      // TODO: Implement actual fix application logic
    }
  };

  const handleCopyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    // TODO: Show toast notification
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
    <div
      className={`${
        isFullscreen ? "fixed inset-0 z-50 bg-white" : "max-w-full"
      }`}
    >
      {/* Enhanced Monaco Editor CSS */}
      <style>{`
        .monaco-error-decoration {
          background-color: rgba(255, 0, 0, 0.15);
          border-bottom: 2px wavy #ff0000;
        }
        .monaco-warning-decoration {
          background-color: rgba(255, 165, 0, 0.10);
          border-bottom: 2px wavy #ffa500;
        }
        .monaco-info-decoration {
          background-color: rgba(0, 123, 255, 0.10);
          border-bottom: 2px wavy #007bff;
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
        .monaco-info-glyph {
          background: #007bff;
          width: 16px !important;
          height: 16px;
          border-radius: 50%;
          margin-left: 3px;
        }
      `}</style>

      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                <ArrowLeft size={20} />
                Back
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Manual Correction
                  </h1>
                  <p className="text-sm text-gray-600">
                    {fileDetail?.file_name || fileId}
                  </p>
                </div>
              </div>
            </div>

            {/* Center - Progress & Navigation */}
            {totalErrors > 0 && (
              <div className="flex items-center gap-4">
                <button
                  onClick={navigateToPreviousError}
                  disabled={totalErrors === 0}
                  className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  title="Previous Error (Shift+F8)"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-700">
                    {currentErrorIndex >= 0 ? currentErrorIndex + 1 : 0} /{" "}
                    {totalErrors}
                  </div>
                  <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                      style={{ width: `${errorProgress}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={navigateToNextError}
                  disabled={totalErrors === 0}
                  className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  title="Next Error (F8)"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <button
                  onClick={handleRevertChanges}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Revert Changes"
                >
                  <RotateCcw size={16} />
                  Revert
                </button>
              )}
              <button
                onClick={() => setShowErrorPanel(!showErrorPanel)}
                className={`p-2 rounded transition-colors ${
                  showErrorPanel
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100"
                }`}
                title="Toggle Error List"
              >
                <List size={20} />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize2 size={20} />
                ) : (
                  <Maximize2 size={20} />
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !!jsonError ||
                  !jsonContent.trim() ||
                  !hasUnsavedChanges
                }
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Save size={18} />
                {saving
                  ? "Saving..."
                  : hasUnsavedChanges
                  ? "Save Changes"
                  : "Saved"}
              </button>
            </div>
          </div>

          {/* Unsaved changes indicator */}
          {hasUnsavedChanges && (
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-800">
              <AlertCircle size={16} />
              <span>You have unsaved changes. Press Ctrl+S to save.</span>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Error Navigation Panel */}
          {showErrorPanel && validationErrors && (
            <div className="w-80 flex-shrink-0 overflow-hidden">
              <ErrorNavigationPanel
                ediErrors={validationErrors.ediErrors}
                fileErrors={validationErrors.fileErrors}
                currentErrorIndex={currentErrorIndex}
                onErrorClick={handleErrorClick}
                onClose={() => setShowErrorPanel(false)}
              />
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">
                    Loading file data...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Editor Toolbar */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h2 className="text-sm font-semibold text-gray-900">
                      JSON Editor
                    </h2>
                    {totalErrors > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                          {validationErrors?.ediErrors.filter(
                            (e) => e.severity === "ERROR"
                          ).length || 0}{" "}
                          Errors
                        </span>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                          {validationErrors?.ediErrors.filter(
                            (e) => e.severity === "WARNING"
                          ).length || 0}{" "}
                          Warnings
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={formatJson}
                    className="px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded hover:bg-primary-100 transition-colors"
                  >
                    Format JSON
                  </button>
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden">
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
                      folding: true,
                      foldingStrategy: "indentation",
                    }}
                  />
                </div>

                {/* Status Bar */}
                <div className="px-6 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-4">
                    <span>File ID: {fileId}</span>
                    {jsonError && (
                      <span className="text-red-600 font-medium">
                        {jsonError}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>
                      Keyboard Shortcuts: Ctrl+S (Save) | F8 (Next Error) |
                      Shift+F8 (Prev Error)
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Help/Suggestions Panel */}
          {showHelpPanel && selectedError && (
            <div className="w-96 flex-shrink-0 overflow-y-auto bg-white border-l border-gray-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Lightbulb className="text-yellow-500" size={20} />
                    Quick Fix
                  </h3>
                  <button
                    onClick={() => setShowHelpPanel(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                {/* Current Error Details */}
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle
                      className="text-red-600 flex-shrink-0 mt-0.5"
                      size={16}
                    />
                    <div className="flex-1">
                      <div className="text-xs font-mono text-red-700 mb-1">
                        {selectedError.segment_id ||
                          selectedError.error_location}
                      </div>
                      <div className="text-sm text-red-800 font-medium">
                        {selectedError.error_message}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                <QuickFixSuggestion
                  suggestions={suggestions}
                  onApplyFix={handleApplyFix}
                  onCopyValue={handleCopyValue}
                />

                {/* Field Info */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info
                      className="text-blue-600 flex-shrink-0 mt-0.5"
                      size={16}
                    />
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-1">
                        Field Information
                      </div>
                      <div className="text-xs">
                        <p className="mb-1">
                          <strong>Location:</strong>{" "}
                          {selectedError.error_location}
                        </p>
                        {selectedError.element_id && (
                          <p className="mb-1">
                            <strong>Element:</strong> {selectedError.element_id}
                          </p>
                        )}
                        <p>
                          <strong>Severity:</strong> {selectedError.severity}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toast Notifications */}
        {saveSuccess && (
          <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
            <div className="p-4 bg-green-600 text-white rounded-lg shadow-lg flex items-center gap-3">
              <CheckCircle size={20} />
              <div>
                <div className="font-semibold">Changes Saved Successfully</div>
                <div className="text-sm text-green-100">
                  837 file regeneration started
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
            <div className="p-4 bg-red-600 text-white rounded-lg shadow-lg flex items-center gap-3">
              <XCircle size={20} />
              <div>
                <div className="font-semibold">Error</div>
                <div className="text-sm text-red-100">{error}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualCorrection;
