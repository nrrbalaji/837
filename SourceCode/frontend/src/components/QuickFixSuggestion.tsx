import React from 'react';
import { Lightbulb, CheckCircle, Copy, ExternalLink } from 'lucide-react';

interface FixSuggestion {
  type: 'STATIC' | 'MASTER_LOOKUP' | 'FORMAT' | 'CALCULATION';
  description: string;
  suggestedValue?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  source?: string;
  action?: () => void;
}

interface QuickFixSuggestionProps {
  suggestions: FixSuggestion[];
  onApplyFix: (suggestion: FixSuggestion) => void;
  onCopyValue?: (value: string) => void;
}

const QuickFixSuggestion: React.FC<QuickFixSuggestionProps> = ({
  suggestions,
  onApplyFix,
  onCopyValue
}) => {
  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getFixTypeIcon = (type: string) => {
    switch (type) {
      case 'STATIC':
        return '📝';
      case 'MASTER_LOOKUP':
        return '🔍';
      case 'FORMAT':
        return '✨';
      case 'CALCULATION':
        return '🧮';
      default:
        return '💡';
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="text-gray-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">No Suggestions Available</h4>
            <p className="text-xs text-gray-600">
              No automatic fix suggestions found for this error. Please review and correct manually.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Lightbulb className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-blue-900 mb-1">
            {suggestions.length} Suggested Fix{suggestions.length > 1 ? 'es' : ''} Available
          </h4>
          <p className="text-xs text-blue-700">
            Click "Apply Fix" to automatically correct this error
          </p>
        </div>
      </div>

      {/* Suggestions List */}
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`p-4 border rounded-lg transition-all hover:shadow-md ${getConfidenceColor(suggestion.confidence)}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{getFixTypeIcon(suggestion.type)}</span>
            <div className="flex-1 min-w-0">
              {/* Suggestion Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {suggestion.type.replace('_', ' ')}
                  </span>
                  {suggestion.confidence && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getConfidenceColor(suggestion.confidence)}`}>
                      {suggestion.confidence} confidence
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm font-medium text-gray-800 mb-2">
                {suggestion.description}
              </p>

              {/* Suggested Value */}
              {suggestion.suggestedValue && (
                <div className="mb-3 p-2 bg-white border border-gray-200 rounded font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">{suggestion.suggestedValue}</span>
                    {onCopyValue && (
                      <button
                        onClick={() => onCopyValue(suggestion.suggestedValue!)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Copy value"
                      >
                        <Copy size={14} className="text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Source Info */}
              {suggestion.source && (
                <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                  <ExternalLink size={12} />
                  <span>Source: {suggestion.source}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => onApplyFix(suggestion)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-sm hover:shadow-md"
              >
                <CheckCircle size={16} />
                Apply Fix
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Manual Correction Reminder */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <strong>Note:</strong> Review the suggested fix before applying. You can also manually edit the JSON directly in the editor.
        </p>
      </div>
    </div>
  );
};

export default QuickFixSuggestion;
