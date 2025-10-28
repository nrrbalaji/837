# Manual Correction Page - Visual Guide

## 🎨 Complete Visual Walkthrough

This guide provides ASCII diagrams and descriptions to help you understand the enhanced Manual Correction page layout and features.

---

## 📐 Full Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HEADER (Fixed)                                     │
│  ← Back    📄 Manual Correction                [5 / 23]        ⬅️  ═▓▓░  ➡️     │
│            file_name.837                     Progress: 22%                      │
│                                                                                 │
│  ⚠️  Unsaved changes. Press Ctrl+S to save.                                     │
│                                              [🔄 Revert] [📋] [⛶] [💾 Save]    │
├─────────┬───────────────────────────────────────────────┬───────────────────────┤
│ ERROR   │         JSON EDITOR                           │   QUICK FIX           │
│ PANEL   │                                               │   PANEL               │
│ (280px) │                                               │   (384px)             │
│         │                                               │                       │
│╔════════│                                               │═══════════════════════╗
││Summary ││         1  {                                 ││ 💡 Quick Fix      [X]│
││        ││         2    "isa": {                        ││                      │
││ 15  8   ││         3      "sender_id": "ABC123"        ││ Current Error:       │
││ERRORS  ││         4    },                              ││                      │
││        ││         5    "claims": [                     ││ ❌ Invalid NPI       │
│├────────││         6      {                             ││ Location: NM1-09     │
││🔍Search││         7        "claim_id": "CLM001",       ││                      │
││        ││         8        "provider": {  ⚠️ ─┐        │├──────────────────────│
│├────────││         9          "npi": "123",   │        ││ Suggestions (2):     │
││Filter: ││        10          "name": "Dr Smith"│       ││                      │
││  All ▼ ││        11        },                 │       ││ 🔍 MASTER_LOOKUP     │
│├────────││        12        "patient": {       │       ││ [HIGH confidence]    │
││        ││        13          "id": "PAT001"   │       ││ Lookup NPI from      │
││▼ EDI   ││        14        },                 │       ││ Provider Master      │
││ (15)   ││        15        "amount": 100.50   │       ││                      │
││  ▼ CLM ││        16      }                    │       ││ Value: 1234567890    │
││  (5)   ││        17    ]                      │       ││ Source: Master DB    │
││  ⚠️ 001 ││        18  }                        │       ││                      │
││  ❌ 002 ││                                     │       ││ [✓ Apply Fix]        │
││  ▼ NM1 ││  Error at line 9: Invalid NPI ──────┘       │├──────────────────────│
││  (10)  ││  Length must be 10 digits                   ││ ✨ FORMAT            │
││  ❌ 003 ││  💡 Click error to see suggestions          ││ [MEDIUM confidence]  │
││  ❌ 004 ││                                             ││ Apply NPI format     │
││        ││                                             ││ validation rules     │
││▼ FILE  ││                                             ││                      │
││ (8)    ││                                             ││ [✓ Apply Fix]        │
││  ⚠️ 005 ││                                             │├──────────────────────│
││        ││                                             ││ ℹ Field Info         │
││        ││                                             ││                      │
││        ││                                             ││ Location: NM1-09     │
││        ││                                             ││ Element: Provider ID │
││        ││                                             ││ Required: Yes        │
││        ││                                             ││ Format: 10 digits    │
│╚════════│                                               │═══════════════════════╝
├─────────┴───────────────────────────────────────────────┴───────────────────────┤
│ STATUS BAR:  File ID: abc-123  •  JSON Valid ✓  •  Shortcuts: Ctrl+S F8 Shift+F8│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Component Breakdowns

### 1. Header Section (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEFT SECTION                  CENTER SECTION              RIGHT SECTION     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ← Back to Validation Logs                                                  │
│                                                                             │
│ 📄 Manual Correction         Error 5 of 23         [🔄] [📋] [⛶] [💾]     │
│    file_name.837             ⬅️  ═══▓▓▓░░░  ➡️     Revert List Full Save    │
│                                   22% done                                  │
│                                                                             │
│ 💡 HOVER TOOLTIPS:                                                          │
│    ⬅️  = Previous Error (Shift+F8)                                          │
│    ➡️  = Next Error (F8)                                                    │
│    🔄 = Revert all changes                                                  │
│    📋 = Toggle error list                                                   │
│    ⛶  = Fullscreen mode                                                    │
│    💾 = Save changes (Ctrl+S)                                               │
│                                                                             │
│ ⚠️ CONDITIONAL BANNER (when unsaved changes exist):                         │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ ⚠️  You have unsaved changes. Press Ctrl+S to save.                   │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Error Navigation Panel (Left Sidebar)

```
┌─────────────────────────────────┐
│ Validation Errors          [X]  │ ← Close button
├─────────────────────────────────┤
│                                 │
│  ┌───┐  ┌───┐  ┌───┐           │ ← Summary boxes
│  │15 │  │ 8 │  │ 2 │           │
│  │ERR│  │WRN│  │INF│           │
│  └───┘  └───┘  └───┘           │
│  Errors Warns  Info             │
│                                 │
├─────────────────────────────────┤
│ 🔍 Search errors...             │ ← Search input
├─────────────────────────────────┤
│ ⚙️ Filter: [All Severities ▼]   │ ← Severity filter
├─────────────────────────────────┤
│                                 │
│ ▼ EDI Errors (15)              │ ← Collapsible group header
│   ▼ CLM Segment (5)            │ ← Sub-group
│     ┌─────────────────────────┐│
│     │⚠️ Invalid amount format ││ ← Warning error
│     │ CLM-02                  ││
│     └─────────────────────────┘│
│     ┌─────────────────────────┐│
│     │❌ Missing required field││ ← Critical error
│     │ CLM-05                  ││
│     └─────────────────────────┘│
│   ▶ NM1 Segment (10)           │ ← Collapsed sub-group
│                                 │
│ ▼ File Errors (8)              │ ← Another group
│     ┌─────────────────────────┐│
│     │⚠️ File size exceeds limit│ ← Selected/Active
│     │ ISA segment             ││ (highlighted in blue)
│     │← Currently viewing      ││
│     └─────────────────────────┘│
│                                 │
│                                 │
│                                 │ ← Scrollable area
│                                 │
└─────────────────────────────────┘
```

### 3. Monaco Editor Area (Center)

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar                                                 │
│ JSON Editor      [15 Errors] [8 Warnings]   [Format]   │
├─────────────────────────────────────────────────────────┤
│ Line │ Glyph│ Code                        │ Minimap    │
├──────┼──────┼──────────────────────────────┼────────────┤
│   1  │      │ {                            │            │
│   2  │      │   "isa": {                   │ ▓▓▓░░      │
│   3  │      │     "sender_id": "ABC123"    │ ▓▓▓░░      │
│   4  │      │   },                         │ ▓▓▓░░      │
│   5  │      │   "claims": [                │ ▓▓▓░░      │
│   6  │      │     {                        │ ▓▓▓░░      │
│   7  │      │       "claim_id": "CLM001",  │ ▓▓▓░░      │
│   8  │  🔴  │       "provider": {          │ ▓█▓░░ ← Error here
│   9  │  🔴  │         "npi": "123",  ~~~~~~│ ▓█▓░░
│      │      │                    ^^^       │            │
│      │      │                  Red wavy    │            │
│      │      │                  underline   │            │
│  10  │      │         "name": "Dr Smith"   │ ▓▓▓░░      │
│  11  │      │       },                     │ ▓▓▓░░      │
│  12  │      │       "patient": {           │ ▓▓▓░░      │
│  13  │  🟡  │         "id": "PAT001"  ~~~~~│ ▓▓█░░ ← Warning here
│  14  │      │       },                     │ ▓▓▓░░      │
│  15  │      │       "amount": 100.50       │ ▓▓▓░░      │
│  16  │      │     }                        │ ▓▓▓░░      │
│  17  │      │   ]                          │ ▓▓▓░░      │
│  18  │      │ }                            │ ▓▓▓░░      │
│      │      │                              │            │
├──────┴──────┴──────────────────────────────┴────────────┤
│                                                         │
│ 💡 HOVER over line 9:                                   │
│ ┌─────────────────────────────────────────────────────┐│
│ │ ❌ ERROR: Invalid NPI format                        ││
│ │ Location: NM1-09                                    ││
│ │ Expected: 10 digit number                           ││
│ │ Actual: 3 digits                                    ││
│ │                                                     ││
│ │ 💡 Click to see suggestions                         ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Status Bar: File ID: abc-123 • JSON Valid ✓ • Ctrl+S   │
└─────────────────────────────────────────────────────────┘

LEGEND:
🔴 = Error (red dot in glyph margin)
🟡 = Warning (yellow dot in glyph margin)
🔵 = Info (blue dot in glyph margin)
~~~~ = Wavy underline indicating issue
▓ = Content in minimap
█ = Error location in minimap
```

### 4. Quick Fix Suggestion Panel (Right Sidebar)

```
┌─────────────────────────────────────┐
│ 💡 Quick Fix                   [X]  │ ← Close button
├─────────────────────────────────────┤
│                                     │
│ CURRENT ERROR DETAILS               │
│ ┌─────────────────────────────────┐ │
│ │ ❌ ERROR                        │ │
│ │                                 │ │
│ │ NM1-09                          │ │
│ │ Invalid NPI format              │ │
│ │                                 │ │
│ │ Expected: 10 digit number       │ │
│ │ Found: "123" (3 digits)         │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ 💡 2 Suggested Fixes Available      │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ SUGGESTION #1                       │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 MASTER_LOOKUP   [HIGH] ✓    │ │ ← Confidence badge
│ │                                 │ │
│ │ Lookup correct NPI from         │ │
│ │ Provider Master Table           │ │
│ │                                 │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ 1234567890           [Copy] │ │ │ ← Suggested value
│ │ └─────────────────────────────┘ │ │
│ │                                 │ │
│ │ 📊 Source: Master Provider DB   │ │
│ │                                 │ │
│ │    [✓ Apply Fix]               │ │ ← Action button
│ └─────────────────────────────────┘ │
│                                     │
│ SUGGESTION #2                       │
│ ┌─────────────────────────────────┐ │
│ │ ✨ FORMAT   [MEDIUM]            │ │
│ │                                 │ │
│ │ Apply standard NPI formatting   │ │
│ │ rules and validation            │ │
│ │                                 │ │
│ │    [✓ Apply Fix]               │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ ⚠️  REMINDER                         │
│ Review suggested fix before         │
│ applying. You can also edit         │
│ manually in the JSON editor.        │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ ℹ FIELD INFORMATION                 │
│ ┌─────────────────────────────────┐ │
│ │ Location: NM1-09                │ │
│ │ Element: Provider Identifier    │ │
│ │ Required: Yes                   │ │
│ │ Format: 10 numeric digits       │ │
│ │ Qualifier: XX                   │ │
│ │                                 │ │
│ │ 📚 EDI Standard: ANSI X12 837P  │ │
│ │ 🔗 View Documentation →         │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## 🎯 User Interaction Flows

### Flow 1: Navigate to Error and Apply Fix

```
START
  │
  ├─► Click error in Error Panel
  │   │
  │   ├─► Editor jumps to line
  │   ├─► Error highlighted
  │   ├─► Quick Fix panel opens
  │   └─► Suggestions loaded
  │
  ├─► Review suggestions
  │   │
  │   ├─► Read error details
  │   ├─► Check confidence levels
  │   └─► Review field information
  │
  ├─► Apply fix (Option A)
  │   └─► Click "Apply Fix" button
  │       └─► JSON updated
  │           └─► "Unsaved changes" appears
  │
  └─► Manual edit (Option B)
      └─► Type in editor
          └─► Real-time validation
              └─► Save changes (Ctrl+S)
                  └─► Success toast appears
                      └─► 837 file regenerates
                          └─► DONE
```

### Flow 2: Keyboard Navigation Power User

```
START (File loads with 23 errors)
  │
  ├─► Press F8 (go to first error)
  │   │
  │   ├─► Error #1 highlighted
  │   └─► Quick Fix opens
  │
  ├─► Review & fix
  │   └─► Edit manually or apply suggestion
  │
  ├─► Press F8 (next error)
  │   │
  │   ├─► Error #2 highlighted
  │   └─► Progress: 2/23
  │
  ├─► Repeat for all errors
  │   └─► Progress bar fills up
  │
  ├─► Press Ctrl+S (save)
  │   └─► Success notification
  │
  └─► DONE (in <10 minutes instead of 30!)
```

---

## 🎨 Color & Visual States

### Error Severity Colors

```
┌─────────────────────────────────────────────┐
│  ERROR Severity                             │
│  ┌─────────────────────────────────────┐   │
│  │ ❌ ERROR                            │   │ ← Red background
│  │ Background: rgba(255,0,0,0.15)     │   │   Red border
│  │ Border: 2px wavy #ff0000           │   │   Red text
│  │ Text: #dc2626                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  WARNING Severity                           │
│  ┌─────────────────────────────────────┐   │
│  │ ⚠️ WARNING                          │   │ ← Yellow background
│  │ Background: rgba(255,165,0,0.10)   │   │   Orange border
│  │ Border: 2px wavy #ffa500           │   │   Orange text
│  │ Text: #ea580c                      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  INFO Severity                              │
│  ┌─────────────────────────────────────┐   │
│  │ ℹ️ INFO                             │   │ ← Blue background
│  │ Background: rgba(0,123,255,0.10)   │   │   Blue border
│  │ Border: 2px wavy #007bff           │   │   Blue text
│  │ Text: #2563eb                      │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Button States

```
┌─────────────────────────────────────────┐
│ SAVE BUTTON STATES                      │
├─────────────────────────────────────────┤
│                                         │
│ [💾 Save Changes]  ← Default            │
│ Green gradient, enabled                 │
│                                         │
│ [💾 Saving...]  ← During save           │
│ Green gradient, disabled, spinner       │
│                                         │
│ [💾 Saved]  ← After success             │
│ Green gradient, disabled (3 seconds)    │
│                                         │
│ [💾 Save Changes]  ← Disabled           │
│ Gray, no changes or JSON invalid        │
│ Opacity: 50%, cursor: not-allowed       │
└─────────────────────────────────────────┘
```

---

## 📱 Responsive Behaviors

### Panel Collapse States

```
FULLSCREEN MODE OFF (Default):
┌──────┬─────────┬─────┐
│Error │ Editor  │Quick│
│Panel │         │ Fix │
└──────┴─────────┴─────┘
  280px  Flexible  384px

ERROR PANEL COLLAPSED:
┌─────────┬─────┐
│ Editor  │Quick│
│         │ Fix │
└─────────┴─────┘
 Flexible  384px

BOTH PANELS COLLAPSED (Fullscreen Editor):
┌───────────────┐
│    Editor     │
│               │
│               │
└───────────────┘
   100% width

FULLSCREEN MODE:
┌───────────────────────────────┐
│ Editor fills entire viewport  │
│ (Fixed positioning, z-50)     │
└───────────────────────────────┘
```

---

## 🔔 Notification Toasts

```
SUCCESS TOAST (Bottom-right corner):
┌────────────────────────────────────┐
│ ✓ Changes Saved Successfully       │
│   837 file regeneration started    │
└────────────────────────────────────┘
    ↑ Fades in from bottom
    Stays for 3 seconds
    Green background (#10b981)


ERROR TOAST (Bottom-right corner):
┌────────────────────────────────────┐
│ ✗ Error                            │
│   Failed to save changes           │
└────────────────────────────────────┘
    ↑ Fades in from bottom
    Stays until dismissed
    Red background (#dc2626)
```

---

## 📊 Progress Indicators

### Progress Bar Animation

```
Start (0% - No errors viewed):
┌─────────────────────────────────┐
│ 0 / 23                          │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────┘

After viewing 5 errors (22%):
┌─────────────────────────────────┐
│ 5 / 23                          │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────┘
  ↑ Blue gradient fill

All errors viewed (100%):
┌─────────────────────────────────┐
│ 23 / 23  ✓                      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└─────────────────────────────────┘
  ↑ Full blue with checkmark
```

---

This visual guide should help anyone understand the layout and functionality of the enhanced Manual Correction page at a glance!
