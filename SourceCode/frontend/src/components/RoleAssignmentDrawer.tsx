import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Plus, Trash2, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import toast from "react-hot-toast";
import RoleBadge from "./RoleBadge";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://10.1.9.210:3000/api/v1";

interface UserRole {
  role_id: string;
  role_name: string;
  description: string;
  assigned_at: string;
  assigned_by_username: string;
}

interface AvailableRole {
  role_id: string;
  role_name: string;
  description: string;
}

interface RoleAssignmentDrawerProps {
  isOpen: boolean;
  user: {
    user_id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const RoleAssignmentDrawer: React.FC<RoleAssignmentDrawerProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const [currentRoles, setCurrentRoles] = useState<UserRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserRoles();
      fetchAvailableRoles();
    }
  }, [isOpen, user]);

  const fetchUserRoles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/user-roles/${user.user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentRoles(response.data.roles || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      toast.error("Failed to load user roles");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRoles = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/user-roles/${user.user_id}/available`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAvailableRoles(response.data.roles || []);
    } catch (error) {
      console.error("Error fetching available roles:", error);
    }
  };

  const handleAssignRole = async (roleId: string) => {
    if (!user) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/user-roles/${user.user_id}/assign`,
        { role_ids: [roleId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Role assigned successfully");
      setShowAddRole(false);
      fetchUserRoles();
      fetchAvailableRoles();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to assign role");
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!user) return;

    if (!confirm("Are you sure you want to remove this role?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/user-roles/${user.user_id}/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Role removed successfully");
      fetchUserRoles();
      fetchAvailableRoles();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to remove role");
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-700 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Shield size={28} />
                  Manage Roles
                </h2>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 bg-white bg-opacity-20 rounded-lg p-3">
                <div className="w-12 h-12 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                  <User className="text-white" size={24} />
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user.username}
                  </p>
                  <p className="text-purple-100 text-sm">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Current Roles */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="text-purple-600" size={20} />
                    Current Roles ({currentRoles.length})
                  </h3>
                  <button
                    onClick={() => setShowAddRole(!showAddRole)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-all shadow-md"
                  >
                    <Plus size={16} />
                    Assign Role
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-600 text-sm">Loading roles...</p>
                  </div>
                ) : currentRoles.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <Shield className="mx-auto text-gray-400 mb-3" size={40} />
                    <p className="text-gray-600 font-medium">No roles assigned</p>
                    <p className="text-gray-500 text-sm mt-1">
                      Click "Assign Role" to add a role
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentRoles.map((role) => (
                      <motion.div
                        key={role.role_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <RoleBadge roleName={role.role_name} size="md" />
                            </div>
                            {role.description && (
                              <p className="text-sm text-gray-600 mt-2">{role.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveRole(role.role_id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Remove role"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {/* Audit Info */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-purple-200">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>
                              Assigned{" "}
                              {formatDistanceToNow(new Date(role.assigned_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          {role.assigned_by_username && (
                            <div className="flex items-center gap-1">
                              <User size={12} />
                              <span>by {role.assigned_by_username}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Role Section */}
              {showAddRole && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-gray-200 pt-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="text-green-600" size={20} />
                    Available Roles
                  </h3>

                  {availableRoles.length === 0 ? (
                    <div className="text-center py-8 border border-gray-200 rounded-lg">
                      <p className="text-gray-600">All roles have been assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableRoles.map((role) => (
                        <div
                          key={role.role_id}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{role.role_name}</p>
                            {role.description && (
                              <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAssignRole(role.role_id)}
                            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-all"
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <button
                onClick={onClose}
                className="w-full px-5 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RoleAssignmentDrawer;
