# Manual Correction Page Implementation

## Overview
Enhanced the Manual Correction page with Monaco Editor and integrated validation error highlighting for editing parsed 837 JSON data.

## Features Implemented

### 1. Backend Enhancements

#### New API Endpoint: Get Validation Errors
- **Route**: `GET /api/v1/files/:fileId/validation-errors`
- **Purpose**: Fetch all validation errors (EDI + File level) for a specific file
- **Response**:
  ```json
  {
    "ediErrors": [...],
    "fileErrors": [...],
    "totalErrors": 10
  }
  ```

#### Updated API Endpoint: Update Parsed JSON
- **Route**: `PUT /api/v1/files/:fileId/parsed-json`
- **Purpose**: Save edited parsed JSON and trigger 837 file regeneration
- **New Features**:
  - Automatically regenerates 837 file in background after save
  - Maintains audit trail of manual corrections
  - Returns success message indicating regeneration started

**File Modified**: [backend/routes/files.js](backend/routes/files.js)

### 2. Frontend Enhancements

#### Monaco Editor Integration
- **Package**: `@monaco-editor/react` + `monaco-editor`
- **Features**:
  - Syntax highlighting for JSON
  - Auto-formatting
  - Code completion
  - Minimap navigation
  - Line numbers
  - Word wrap
  - Bracket matching

#### Validation Error Highlighting
- **Visual Indicators**:
  - **RED decorations**: ERROR severity (with wavy red underline)
  - **YELLOW decorations**: WARNING severity (with wavy yellow underline)
  - **Glyph margin**: Colored dots in left margin (red/yellow)
  - **Hover tooltips**: Show error message and location on hover
  - **Monaco markers**: Error/warning markers in Problems panel

#### Error Summary Panel
- Displays total validation errors count
- Breaks down errors by type:
  - EDI Errors
  - File Errors
- Shows helpful message about error highlighting

**File Modified**: [frontend/src/pages/ManualCorrection.tsx](frontend/src/pages/ManualCorrection.tsx)

## How It Works

### 1. Page Load
1. Fetches parsed JSON from `/api/v1/files/:fileId/parsed-json`
2. Fetches validation errors from `/api/v1/files/:fileId/validation-errors`
3. Displays JSON in Monaco Editor
4. Applies error decorations based on validation errors

### 2. Error Highlighting Logic
```typescript
const applyErrorDecorations = (editor, monaco, errors) => {
  // For each validation error:
  // 1. Find the line number in JSON where error occurs
  // 2. Create Monaco decoration with appropriate color
  // 3. Add glyph margin indicator
  // 4. Set hover message with error details
  // 5. Create Monaco marker for Problems panel
}
```

### 3. Save Flow
1. User edits JSON in Monaco Editor
2. Validates JSON syntax on-the-fly
3. Clicks "Save Changes" button
4. Sends updated JSON to backend
5. Backend:
   - Updates `parsed_json` column in `UploadFileDetail`
   - Logs change in `AuditLog`
   - Triggers background 837 file regeneration
6. Frontend:
   - Shows success message
   - Refreshes validation errors
   - Re-applies decorations

### 4. 837 File Regeneration
When JSON is saved, the backend automatically:
1. Calls `generate837Service.generate837File(parsed_json, filePath)`
2. Generates new 837 EDI file from updated JSON
3. Overwrites original file at `file_path`
4. Runs in background (non-blocking)

## Usage Instructions

### For Users:
1. Navigate to **Validation Logs** page
2. Click on a file with validation errors
3. Click **"Manual Correction"** button
4. The Manual Correction page will open with:
   - File name displayed in header
   - Validation error summary at top
   - Monaco Editor with JSON content
   - Errors highlighted in red (ERROR) and yellow (WARNING)
5. Edit the JSON to fix errors
6. Hover over highlighted areas to see error details
7. Click **"Save Changes"** to save
8. The 837 file will be automatically regenerated

### For Developers:
```bash
# Frontend (if not already installed)
cd frontend
npm install @monaco-editor/react monaco-editor

# Backend (no changes needed - endpoint already exists)
# Just make sure generate837 service is working
```

## File Structure

```
backend/
├── routes/
│   └── files.js              # Enhanced with validation-errors endpoint
└── services/
    └── generate837.js         # Used for 837 regeneration (existing)

frontend/
├── src/
│   └── pages/
│       └── ManualCorrection.tsx   # Completely rewritten with Monaco Editor
└── package.json                    # Added monaco dependencies
```

## API Documentation

### GET /api/v1/files/:fileId/validation-errors
**Description**: Get all validation errors for a file

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "ediErrors": [
    {
      "validation_id": "uuid",
      "segment_id": "CLM",
      "element_id": "CLM02",
      "error_message": "Invalid amount format",
      "error_location": "CLM segment",
      "severity": "ERROR",
      "validated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "fileErrors": [
    {
      "validation_id": "uuid",
      "validation_rule": "File Size Check",
      "error_message": "File size exceeds limit",
      "error_location": "ISA segment",
      "severity": "WARNING",
      "validated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "totalErrors": 2
}
```

### PUT /api/v1/files/:fileId/parsed-json
**Description**: Update parsed JSON and regenerate 837 file

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body**:
```json
{
  "parsed_json": {
    "isa": { ... },
    "gs": { ... },
    "claims": [ ... ]
  }
}
```

**Response** (200 OK):
```json
{
  "message": "Parsed JSON updated successfully. 837 file regeneration started.",
  "file_id": "uuid",
  "file_name": "claim_file.837"
}
```

## Monaco Editor Configuration

```typescript
{
  minimap: { enabled: true },           // Show minimap on right
  fontSize: 14,                         // Font size
  lineNumbers: 'on',                    // Show line numbers
  renderWhitespace: 'selection',        // Show whitespace when selected
  scrollBeyondLastLine: false,          // Don't scroll past last line
  automaticLayout: true,                // Auto-resize
  tabSize: 2,                          // 2-space indentation
  wordWrap: 'on',                      // Wrap long lines
  wrappingIndent: 'indent',            // Maintain indentation when wrapping
  formatOnPaste: true,                 // Auto-format on paste
  formatOnType: true,                  // Auto-format as you type
  glyphMargin: true,                   // Show glyph margin for error indicators
}
```

## CSS Styling for Decorations

```css
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
```

## Testing Checklist

- [ ] Load Manual Correction page with fileId parameter
- [ ] Verify Monaco Editor loads with JSON content
- [ ] Check if validation errors are highlighted in red/yellow
- [ ] Hover over highlighted areas to see error tooltips
- [ ] Edit JSON and verify syntax validation works
- [ ] Click "Format JSON" button to format content
- [ ] Save changes and verify success message appears
- [ ] Check if 837 file is regenerated in background
- [ ] Verify audit log entry is created
- [ ] Test with files having no validation errors
- [ ] Test with files having both ERROR and WARNING severities

## Known Limitations

1. **Error Location Detection**: The `findJsonPath()` function uses a simple string search to locate errors in the JSON. This may not work perfectly for all error types, especially nested fields.

2. **Large Files**: Monaco Editor may be slow with very large JSON files (>10MB). Consider pagination or lazy loading if needed.

3. **Real-time Validation**: Validation errors are not re-validated in real-time as you edit. You need to save and refresh to see updated validation results.

## Future Enhancements

1. **Better Path Detection**: Use JSONPath or similar library for accurate field location
2. **Auto-correction Suggestions**: Show suggested fixes in tooltips
3. **Diff View**: Show before/after comparison when saving
4. **Undo/Redo**: Implement proper undo/redo stack
5. **Real-time Validation**: Validate JSON against business rules as you type
6. **Collapsible Sections**: Make large JSON sections collapsible for easier navigation

## Related Files

- [backend/services/validation.js](backend/services/validation.js) - Contains validation logic
- [backend/services/generate837.js](backend/services/generate837.js) - Generates 837 files
- [backend/database/schema.sql](backend/database/schema.sql) - Database schema with validation tables
- [frontend/src/pages/ValidationLogs.tsx](frontend/src/pages/ValidationLogs.tsx) - Links to Manual Correction page

## Support

For issues or questions, please refer to:
- Monaco Editor docs: https://microsoft.github.io/monaco-editor/
- React Monaco Editor: https://github.com/suren-atoyan/monaco-react

---

**Implementation Date**: January 2025
**Status**: ✅ Complete
**Next Steps**: Testing in development environment
