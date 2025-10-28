# Quick Field Path Reference Card

## 🎯 Your Specific Use Case: Procedure Modifier 1

### ✅ CORRECT Field Path:
```
serviceLines[*].procedureModifier1
```

### ❌ INCORRECT Field Path:
```
claims[*].claims[*].serviceLines[*].procedureModifier1
```

---

## Most Common Field Paths

### Provider Information
```
billing.identificationCode           // Provider NPI
billing.lastName                      // Provider name
billing.taxId                         // Tax ID
renderingProvider.identificationCode  // Rendering provider NPI
```

### Patient Information
```
patient.firstName                     // Patient first name
patient.lastName                      // Patient last name
patient.dateOfBirth                   // Patient DOB
patient.gender                        // M, F, U
patient.zipCode                       // Patient ZIP
```

### Service Lines (Always use [*])
```
serviceLines[*].procedureCode         // CPT/HCPCS code
serviceLines[*].procedureModifier1    // Modifier 1
serviceLines[*].procedureModifier2    // Modifier 2
serviceLines[*].procedureModifier3    // Modifier 3
serviceLines[*].procedureModifier4    // Modifier 4
serviceLines[*].revenueCode           // Revenue code (837I)
serviceLines[*].lineItemCharge        // Charge amount
serviceLines[*].serviceUnitCount      // Units
serviceLines[*].placeOfService        // POS code
```

### Diagnoses (Always use [*])
```
diagnoses[*].code                     // ICD-10 code
diagnoses[*].codeListQualifier        // ABK for ICD-10
```

### Claim Header
```
claimNumber                           // Claim ID
totalCharge                           // Total billed
placeOfService                        // POS code
claimType                             // Professional/Institutional
```

### Dates
```
serviceDateFrom                       // Service start
serviceDateTo                         // Service end
admissionDate                         // Admission date
dischargeDate                         // Discharge date
```

---

## 💡 Pro Tips

1. **Use the "Browse Fields" button** - It shows all available paths with examples
2. **Use [*] for arrays** - Service lines and diagnoses are arrays
3. **Test your rules** - Always test with sample data before activating

---

## Example Validation Rule for Modifier 1

```javascript
{
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "pattern": "^[A-Z0-9]{2}$",
    "minLength": 2,
    "maxLength": 2
  },
  "error_message_template": "Invalid modifier 1: {value}. Must be 2 alphanumeric characters."
}
```

This will validate ALL service lines in the claim, checking that modifier 1 (when present) is exactly 2 alphanumeric characters.
