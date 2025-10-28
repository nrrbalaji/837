import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { X, Code } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface RoleFormData {
  role_name: string;
  description: string;
  permissions: any;
}

interface RoleFormProps {
  mode: "add" | "edit" | "view";
  roleData?: any;
  onClose: () => void;
  onSuccess: () => void;
}

// Common permissions template
const PERMISSION_TEMPLATES = {
  admin: {
    users: ["create", "read", "update", "delete"],
    roles: ["create", "read", "update", "delete"],
    facilities: ["create", "read", "update", "delete"],
    providers: ["create", "read", "update", "delete"],
    claims: ["create", "read", "update", "delete"],
    reports: ["read", "export"],
  },
  manager: {
    users: ["read", "update"],
    facilities: ["read", "update"],
    providers: ["read", "update"],
    claims: ["create", "read", "update"],
    reports: ["read", "export"],
  },
  user: {
    claims: ["create", "read"],
    reports: ["read"],
  },
};

const RoleForm: React.FC<RoleFormProps> = ({ mode, roleData, onClose, onSuccess }) => {
  const [permissionMode, setPermissionMode] = useState<"simple" | "json">("simple");
  const [jsonError, setJsonError] = useState<string>("");

  const validationSchema = Yup.object({
    role_name: Yup.string()
      .required("Role name is required")
      .min(2, "Role name must be at least 2 characters")
      .max(50, "Role name must be less than 50 characters")
      .matches(
        /^[a-zA-Z0-9_\s]+$/,
        "Role name can only contain letters, numbers, underscores, and spaces"
      ),
    description: Yup.string().max(500, "Description is too long"),
  });

  const initialValues: RoleFormData = {
    role_name: roleData?.role_name || "",
    description: roleData?.description || "",
    permissions: roleData?.permissions || {},
  };

  const handleSubmit = async (values: RoleFormData, { setSubmitting }: any) => {
    try {
      const token = localStorage.getItem("token");

      // Validate JSON if in JSON mode
      if (permissionMode === "json" && typeof values.permissions === "string") {
        try {
          JSON.parse(values.permissions);
        } catch (e) {
          setJsonError("Invalid JSON format");
          setSubmitting(false);
          return;
        }
      }

      if (mode === "add") {
        await axios.post(`${API_BASE}/roles`, values, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Role created successfully");
      } else if (mode === "edit") {
        await axios.put(`${API_BASE}/roles/${roleData.role_id}`, values, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Role updated successfully");
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error("Role name already exists");
      } else {
        toast.error(error.response?.data?.error || "Operation failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (template: keyof typeof PERMISSION_TEMPLATES, setFieldValue: any) => {
    setFieldValue("permissions", PERMISSION_TEMPLATES[template]);
    toast.success(`${template.charAt(0).toUpperCase() + template.slice(1)} template applied`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {mode === "add" ? "Add New Role" : mode === "edit" ? "Edit Role" : "View Role"}
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
                <div className="space-y-6">
                  {/* Role Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Role Name <span className="text-red-500">*</span>
                    </label>
                    <Field
                      name="role_name"
                      type="text"
                      disabled={mode === "view"}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 disabled:bg-gray-100"
                      placeholder="e.g., Admin, Manager, User"
                    />
                    <ErrorMessage
                      name="role_name"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <Field
                      as="textarea"
                      name="description"
                      disabled={mode === "view"}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 disabled:bg-gray-100"
                      placeholder="Brief description of this role's purpose..."
                    />
                    <ErrorMessage
                      name="description"
                      component="div"
                      className="text-red-500 text-xs mt-1"
                    />
                  </div>

                  {/* Permissions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Permissions
                      </label>
                      {mode !== "view" && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPermissionMode(permissionMode === "simple" ? "json" : "simple")}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                          >
                            <Code size={14} />
                            {permissionMode === "simple" ? "Switch to JSON" : "Switch to Simple"}
                          </button>
                        </div>
                      )}
                    </div>

                    {mode !== "view" && permissionMode === "simple" && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800 mb-2 font-medium">Quick Templates:</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => applyTemplate("admin", setFieldValue)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                          >
                            Admin (Full Access)
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTemplate("manager", setFieldValue)}
                            className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition"
                          >
                            Manager
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTemplate("user", setFieldValue)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                          >
                            User (Read Only)
                          </button>
                        </div>
                      </div>
                    )}

                    {permissionMode === "json" ? (
                      <div>
                        <textarea
                          disabled={mode === "view"}
                          value={
                            typeof values.permissions === "string"
                              ? values.permissions
                              : JSON.stringify(values.permissions, null, 2)
                          }
                          onChange={(e) => {
                            setFieldValue("permissions", e.target.value);
                            setJsonError("");
                          }}
                          rows={12}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 font-mono text-sm disabled:bg-gray-100"
                          placeholder={`{\n  "users": ["create", "read", "update"],\n  "claims": ["read"]\n}`}
                        />
                        {jsonError && (
                          <p className="text-red-500 text-xs mt-1">{jsonError}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Define permissions as JSON. Example: {"{"}
                          "resource": ["action1", "action2"]{"}"}
                        </p>
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {JSON.stringify(values.permissions, null, 2) || "{}"}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* User Count (View/Edit mode only) */}
                  {mode !== "add" && roleData?.user_count !== undefined && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">{roleData.user_count}</span> user(s)
                        currently assigned to this role
                      </p>
                    </div>
                  )}
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
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? "Saving..."
                      : mode === "add"
                      ? "Create Role"
                      : "Update Role"}
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

export default RoleForm;
