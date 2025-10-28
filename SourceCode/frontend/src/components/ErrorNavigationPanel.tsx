import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, X, Filter } from 'lucide-react';

interface ValidationError {
  validation_id: string;
  segment_id?: string;
  element_id?: string;
  validation_rule?: string;
  error_message: string;
  error_location: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  validated_at: string;
  line?: number;
}

interface ErrorGroup {
  segment: string;
  errors: ValidationError[];
}

interface ErrorNavigationPanelProps {
  ediErrors: ValidationError[];
  fileErrors: ValidationError[];
  currentErrorIndex: number;
  onErrorClick: (error: ValidationError, index: number) => void;
  onClose?: () => void;
  isCollapsed?: boolean;
}

const ErrorNavigationPanel: React.FC<ErrorNavigationPanelProps> = ({
  ediErrors,
  fileErrors,
  currentErrorIndex,
  onErrorClick,
  onClose,
  isCollapsed = false
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['EDI', 'FILE']));
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const allErrors = [...ediErrors, ...fileErrors];

  // Filter errors based on severity and search
  const filteredErrors = allErrors.filter(error => {
    const matchesSeverity = severityFilter === 'ALL' || error.severity === severityFilter;
    const matchesSearch = error.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          error.error_location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  // Define hierarchical order for EDI segments (ISA → GS → ST → HL → other segments)
  const getSegmentOrder = (segment: string): number => {
    const order: Record<string, number> = {
      'ISA': 1,
      'GS': 2,
      'ST': 3,
      'BHT': 4,
      'HL': 5,
      'NM1': 6,
      'N3': 7,
      'N4': 8,
      'REF': 9,
      'PER': 10,
      'CLM': 11,
      'DTP': 12,
      'HI': 13,
      'LX': 14,
      'SV1': 15,
      'SV2': 16,
      'SE': 97,
      'GE': 98,
      'IEA': 99
    };
    return order[segment] || 50; // Unknown segments go in the middle
  };

  // Group EDI errors by segment with hierarchical ordering
  const groupErrorsBySegment = (errors: ValidationError[]): ErrorGroup[] => {
    const grouped = errors.reduce((acc, error) => {
      const segment = error.segment_id || 'Unknown';
      if (!acc[segment]) {
        acc[segment] = [];
      }
      acc[segment].push(error);
      return acc;
    }, {} as Record<string, ValidationError[]>);

    // Convert to array and sort by hierarchical order
    return Object.entries(grouped)
      .map(([segment, errors]) => ({
        segment,
        errors
      }))
      .sort((a, b) => {
        const orderA = getSegmentOrder(a.segment);
        const orderB = getSegmentOrder(b.segment);
        return orderA - orderB;
      });
  };

  const ediGroups = groupErrorsBySegment(ediErrors);
  const errorCounts = {
    total: allErrors.length,
    errors: allErrors.filter(e => e.severity === 'ERROR').length,
    warnings: allErrors.filter(e => e.severity === 'WARNING').length,
    info: allErrors.filter(e => e.severity === 'INFO').length
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'ERROR':
        return <AlertCircle className="text-red-500" size={16} />;
      case 'WARNING':
        return <AlertTriangle className="text-yellow-500" size={16} />;
      case 'INFO':
        return <Info className="text-blue-500" size={16} />;
      default:
        return <AlertCircle className="text-gray-500" size={16} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR':
        return 'border-l-4 border-red-500 bg-red-50 hover:bg-red-100';
      case 'WARNING':
        return 'border-l-4 border-yellow-500 bg-yellow-50 hover:bg-yellow-100';
      case 'INFO':
        return 'border-l-4 border-blue-500 bg-blue-50 hover:bg-blue-100';
      default:
        return 'border-l-4 border-gray-500 bg-gray-50 hover:bg-gray-100';
    }
  };

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900">Validation Errors</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Close panel"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Error Summary */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-red-50 rounded border border-red-200">
            <div className="text-2xl font-bold text-red-700">{errorCounts.errors}</div>
            <div className="text-xs text-red-600">Errors</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">{errorCounts.warnings}</div>
            <div className="text-xs text-yellow-600">Warnings</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">{errorCounts.info}</div>
            <div className="text-xs text-blue-600">Info</div>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search errors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
        />

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Severities</option>
            <option value="ERROR">Errors Only</option>
            <option value="WARNING">Warnings Only</option>
            <option value="INFO">Info Only</option>
          </select>
        </div>
      </div>

      {/* Error List */}
      <div className="flex-1 overflow-y-auto">
        {/* EDI Errors */}
        {ediErrors.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => toggleGroup('EDI')}
              className="w-full px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-left font-semibold text-indigo-900 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                {expandedGroups.has('EDI') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                EDI Errors ({ediErrors.length})
              </span>
            </button>
            {expandedGroups.has('EDI') && (
              <div className="bg-white">
                {ediGroups.map((group) => (
                  <div key={group.segment} className="border-b border-gray-100">
                    <button
                      onClick={() => toggleGroup(`EDI-${group.segment}`)}
                      className="w-full px-6 py-2 bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-700 flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {expandedGroups.has(`EDI-${group.segment}`) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                        {group.segment} ({group.errors.length})
                      </span>
                    </button>
                    {expandedGroups.has(`EDI-${group.segment}`) && (
                      <div>
                        {group.errors.map((error, index) => {
                          const globalIndex = allErrors.indexOf(error);
                          const isActive = globalIndex === currentErrorIndex;
                          return (
                            <div
                              key={error.validation_id}
                              onClick={() => onErrorClick(error, globalIndex)}
                              className={`px-6 py-3 cursor-pointer transition-all ${getSeverityColor(error.severity)} ${
                                isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {getSeverityIcon(error.severity)}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-mono text-gray-600 mb-1">
                                    {error.element_id || error.error_location}
                                  </div>
                                  <div className="text-sm text-gray-800 break-words">
                                    {error.error_message}
                                  </div>
                                  {isActive && (
                                    <div className="mt-1 text-xs text-blue-600 font-medium">
                                      ← Currently viewing
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File Errors */}
        {fileErrors.length > 0 && (
          <div>
            <button
              onClick={() => toggleGroup('FILE')}
              className="w-full px-4 py-2 bg-purple-100 hover:bg-purple-200 text-left font-semibold text-purple-900 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                {expandedGroups.has('FILE') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                File Errors ({fileErrors.length})
              </span>
            </button>
            {expandedGroups.has('FILE') && (
              <div className="bg-white">
                {fileErrors.map((error) => {
                  const globalIndex = allErrors.indexOf(error);
                  const isActive = globalIndex === currentErrorIndex;
                  return (
                    <div
                      key={error.validation_id}
                      onClick={() => onErrorClick(error, globalIndex)}
                      className={`px-6 py-3 cursor-pointer transition-all ${getSeverityColor(error.severity)} ${
                        isActive ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(error.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono text-gray-600 mb-1">
                            {error.validation_rule || error.error_location}
                          </div>
                          <div className="text-sm text-gray-800 break-words">
                            {error.error_message}
                          </div>
                          {isActive && (
                            <div className="mt-1 text-xs text-blue-600 font-medium">
                              ← Currently viewing
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* No Errors State */}
        {allErrors.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2" size={48} />
            <p className="text-sm">No validation errors found</p>
          </div>
        )}

        {/* No Results from Filter */}
        {allErrors.length > 0 && filteredErrors.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Filter className="mx-auto mb-2" size={48} />
            <p className="text-sm">No errors match your filter</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorNavigationPanel;
