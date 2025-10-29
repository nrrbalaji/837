import React, { useState, useEffect, useRef } from "react";
import { Search, X, Check, Building } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Facility {
  facility_id: string;
  facility_code: string;
  facility_name: string;
  facility_type?: string;
  city?: string;
  state?: string;
}

interface FacilityMultiSelectProps {
  selectedFacilities: string[];
  availableFacilities: Facility[];
  onChange: (facilityIds: string[]) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

const FacilityMultiSelect: React.FC<FacilityMultiSelectProps> = ({
  selectedFacilities,
  availableFacilities,
  onChange,
  disabled = false,
  label = "Assigned Facilities",
  placeholder = "Search facilities...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(""); // Clear search when closing
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const filteredFacilities = availableFacilities.filter((facility) =>
    facility.facility_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    facility.facility_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    facility.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    facility.state?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFacility = (facilityId: string) => {
    if (selectedFacilities.includes(facilityId)) {
      onChange(selectedFacilities.filter((id) => id !== facilityId));
    } else {
      onChange([...selectedFacilities, facilityId]);
    }
  };

  const removeFacility = (facilityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedFacilities.filter((id) => id !== facilityId));
  };



  const selectedCount = selectedFacilities.length;

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
      </label>

      {/* Selected Facilities Display */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[42px] w-full px-4 py-2 border rounded-lg bg-white cursor-pointer transition-all ${
          disabled
            ? "bg-gray-100 cursor-not-allowed"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-200"
            : "border-gray-300 hover:border-blue-400"
        }`}
      >
        {selectedCount === 0 ? (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedFacilities.slice(0, 3).map((facilityId) => {
              const facility = availableFacilities.find((f) => f.facility_id === facilityId);
              if (!facility) return null;

              return (
                <span
                  key={facilityId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded border border-blue-200"
                >
                  <Building size={12} />
                  {facility.facility_name}
                  {!disabled && (
                    <button
                      onClick={(e) => removeFacility(facilityId, e)}
                      className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              );
            })}
            {selectedCount > 3 && (
              <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                +{selectedCount - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden"
          >
            {/* Search */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search facilities..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Facilities List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredFacilities.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No facilities found
                </div>
              ) : (
                filteredFacilities.map((facility) => {
                  const isSelected = selectedFacilities.includes(facility.facility_id);

                  return (
                    <div
                      key={facility.facility_id}
                      onClick={() => toggleFacility(facility.facility_id)}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 hover:bg-blue-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-5 h-5 border-2 rounded flex items-center justify-center ${
                          isSelected
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <Check className="text-white" size={14} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">
                          {facility.facility_name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {facility.facility_code}
                          {facility.city && facility.state && (
                            <> • {facility.city}, {facility.state}</>
                          )}
                          {facility.facility_type && (
                            <> • {facility.facility_type}</>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {selectedCount > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-gray-700 font-medium">
                  {selectedCount} {selectedCount === 1 ? "facility" : "facilities"} selected
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear all
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper text */}
      <p className="text-xs text-gray-500 mt-2">
        {disabled
          ? "Facility assignment is view-only"
          : selectedCount === 0
          ? "Select facilities this user can access"
          : `User will have access to ${selectedCount} ${selectedCount === 1 ? "facility" : "facilities"}`}
      </p>
    </div>
  );
};

export default FacilityMultiSelect;
