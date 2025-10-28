import React, { useState, useEffect } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { X, Eye, EyeOff, Lock } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import FacilityMultiSelect from "./FacilityMultiSelect";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface Role {
  role_id: string;
  role_name: string;
  description: string;
}

interface Facility {
  facility_id: string;
  facility_code: string;
  facility_name: string;
  facility_type?: string;
  city?: string;
  state?: string;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role_ids: string[];
  facility_ids: string[];
}

interface UserFormProps {
  mode: "add" | "edit" | "view";
  userData?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ mode, userData, onClose, onSuccess }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    fetchRoles();
    fetchFacilities();
  }, []);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(response.data.roles || []);
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to load roles");
    }
  };

  const fetchFacilities = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/facilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Handle both array and object responses
      const facilitiesList = Array.isArray(response.data) ? response.data : response.data.facilities || [];
      setFacilities(facilitiesList);
      console.log("Facilities loaded successfully:", facilitiesList.length);
    } catch (error: any) {
      console.error("Error fetching facilities:", error);
      console.error("Error details:", {
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        url: `${API_BASE}/facilities`
      });

      // Don't show error toast if facilities endpoint is not critical
      // User form can still work without facility assignment
      if (error.response?.status !== 404) {
        toast.error("Failed to load facilities. Facility assignment will be unavailable.");
      }
    }
  };

  const validationSchema = Yup.object({
    username: Yup.string()
      .required("Username is required")
      .min(3, "Username must be at least 3 characters")
      .max(50, "Username must be less than 50 characters")
      .matches(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: Yup.string()
      .required("Email is required")
      .email("Invalid email format"),
    password:
      mode === "add"
        ? Yup.string()
            .required("Password is required")
            .min(8, "Password must be at least 8 characters")
            .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
            .matches(/[a-z]/, "Password must contain at least one lowercase letter")
            .matches(/[0-9]/, "Password must contain at least one number")
        : Yup.string()
            .min(8, "Password must be at least 8 characters")
            .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
            .matches(/[a-z]/, "Password must contain at least one lowercase letter")
            .matches(/[0-9]/, "Password must contain at least one number"),
    first_name: Yup.string().max(100, "First name is too long"),
    last_name: Yup.string().max(100, "Last name is too long"),
    is_active: Yup.boolean(),
    role_ids: Yup.array().of(Yup.string()),
    facility_ids: Yup.array().of(Yup.string()),
  });

  const initialValues: UserFormData = {
    username: userData?.username || "",
    email: userData?.email || "",
    password: "",
    first_name: userData?.first_name || "",
    last_name: userData?.last_name || "",
    is_active: userData?.is_active ?? true,
    role_ids: userData?.roles?.map((r: any) => r.role_id) || [],
    facility_ids: userData?.facilities?.map((f: any) => f.facility_id) || [],
  };

  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^A-Za-z0-9]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 40) return "bg-red-500";
    if (strength < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthLabel = (strength: number): string => {
    if (strength < 40) return "Weak";
    if (strength < 70) return "Medium";
    return "Strong";
  };

  const handleSubmit = async (values: UserFormData, { setSubmitting }: any) => {
    try {
      const token = localStorage.getItem("token");
      const payload = { ...values };

      // Remove password if empty in edit mode
      if (mode === "edit" && !payload.password) {
        delete payload.password;
      }

      let userId: string;

      if (mode === "add") {
        const userResponse = await axios.post(`${API_BASE}/users`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        userId = userResponse.data.user_id;
        toast.success("User created successfully");
      } else if (mode === "edit") {
        await axios.put(`${API_BASE}/users/${userData.user_id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        userId = userData.user_id;
        toast.success("User updated successfully");
      } else {
        return;
      }

      // Save facility assignments
      if (values.facility_ids && values.facility_ids.length > 0) {
        try {
          await axios.put(
            `${API_BASE}/user-facilities/${userId}/replace`,
            { facility_ids: values.facility_ids },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (facilityError) {
          console.error("Error saving facility assignments:", facilityError);
          toast.error("User saved but facility assignment failed");
        }
      } else {
        // Clear all facility assignments if none selected
        try {
          await axios.put(
            `${API_BASE}/user-facilities/${userId}/replace`,
            { facility_ids: [] },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (facilityError) {
          console.error("Error clearing facility assignments:", facilityError);
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error("Username or email already exists");
      } else {
        toast.error(error.response?.data?.error || "Operation failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {mode === "add" ? "Add New User" : mode === "edit" ? "Edit User" : "View User"}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ values, isSubmitting, setFieldValue }) => (
            <Form>
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                <div className="grid grid-cols-2 gap-6">
                  {/* Username */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <Field
                      name="username"
                      type="text"
                      disabled={mode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100"
                      placeholder="johndoe"
                    />
                    <ErrorMessage
                      name="username"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Field
                      name="email"
                      type="email"
                      disabled={mode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100"
                      placeholder="john@example.com"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name
                    </label>
                    <Field
                      name="first_name"
                      type="text"
                      disabled={mode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100"
                      placeholder="John"
                    />
                    <ErrorMessage
                      name="first_name"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name
                    </label>
                    <Field
                      name="last_name"
                      type="text"
                      disabled={mode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100"
                      placeholder="Doe"
                    />
                    <ErrorMessage
                      name="last_name"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  {/* Password */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password {mode === "add" && <span className="text-red-500">*</span>}
                      {mode === "edit" && (
                        <span className="text-gray-500 text-xs font-normal">
                          {" "}
                          (leave blank to keep current)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <Field
                        name="password"
                        type={showPassword ? "text" : "password"}
                        disabled={mode === "view"}
                        className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100"
                        placeholder="Enter password"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFieldValue("password", e.target.value);
                          setPasswordStrength(calculatePasswordStrength(e.target.value));
                        }}
                      />
                      {mode !== "view" && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      )}
                    </div>
                    <ErrorMessage
                      name="password"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />

                    {/* Password Strength Indicator */}
                    {mode !== "view" && values.password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Password Strength:</span>
                          <span
                            className={`font-semibold ${
                              passwordStrength < 40
                                ? "text-red-600"
                                : passwordStrength < 70
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {getPasswordStrengthLabel(passwordStrength)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${getPasswordStrengthColor(
                              passwordStrength
                            )}`}
                            style={{ width: `${passwordStrength}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Roles */}
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Assign Roles
                    </label>
                    <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                      {roles.length === 0 ? (
                        <p className="text-sm text-gray-500">No roles available</p>
                      ) : (
                        <div className="space-y-2">
                          {roles.map((role) => (
                            <label
                              key={role.role_id}
                              className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                disabled={mode === "view"}
                                checked={values.role_ids.includes(role.role_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFieldValue("role_ids", [...values.role_ids, role.role_id]);
                                  } else {
                                    setFieldValue(
                                      "role_ids",
                                      values.role_ids.filter((id) => id !== role.role_id)
                                    );
                                  }
                                }}
                                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{role.role_name}</div>
                                {role.description && (
                                  <div className="text-xs text-gray-500">{role.description}</div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Facilities */}
                  <div className="col-span-2">
                    <FacilityMultiSelect
                      selectedFacilities={values.facility_ids}
                      availableFacilities={facilities}
                      onChange={(facilityIds) => setFieldValue("facility_ids", facilityIds)}
                      disabled={mode === "view"}
                      label="Assigned Facilities"
                      placeholder="Select facilities this user can access..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      If no facilities are assigned, user will have access based on their role permissions
                    </p>
                  </div>

                  {/* Active Status */}
                  <div className="col-span-2">
                    <label className="flex items-center gap-3">
                      <Field
                        name="is_active"
                        type="checkbox"
                        disabled={mode === "view"}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">Active User</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-8">
                      Inactive users cannot log in to the system
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              {mode !== "view" && (
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? "Saving..."
                      : mode === "add"
                      ? "Create User"
                      : "Update User"}
                  </button>
                </div>
              )}
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default UserForm;
