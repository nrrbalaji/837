import React from "react";
import { Edit, Trash2, Eye, Users, ChevronLeft, ChevronRight } from "lucide-react";

interface Role {
  role_id: string;
  role_name: string;
  description: string;
  permissions: any;
  user_count: number;
  created_at: string;
}

interface RoleListProps {
  roles: Role[];
  loading: boolean;
  currentPage?: number;
  totalPages?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  onPageChange?: (page: number) => void;
  onSort?: (field: string) => void;
  onEdit: (role: Role) => void;
  onView: (role: Role) => void;
  onDelete: (roleId: string) => void;
}

const RoleList: React.FC<RoleListProps> = ({
  roles,
  loading,
  currentPage = 1,
  totalPages = 1,
  sortField = "role_name",
  sortOrder = "asc",
  onPageChange,
  onSort,
  onEdit,
  onView,
  onDelete,
}) => {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading roles...</p>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="p-12 text-center">
        <Users className="mx-auto text-gray-400 mb-4" size={48} />
        <p className="text-gray-700 font-medium mb-2">No roles found</p>
        <p className="text-sm text-gray-500">Create your first role to get started</p>
      </div>
    );
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const getPermissionsSummary = (permissions: any): string => {
    if (!permissions || typeof permissions !== "object") return "None";

    const permArray = Object.keys(permissions);
    if (permArray.length === 0) return "None";
    if (permArray.length <= 2) return permArray.join(", ");
    return `${permArray.slice(0, 2).join(", ")} +${permArray.length - 2} more`;
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
            <tr>
              {[
                { field: "role_name", label: "Role Name" },
                { field: "description", label: "Description", sortable: false },
                { field: "permissions", label: "Permissions", sortable: false },
                { field: "user_count", label: "Users", sortable: false },
                { field: "created_at", label: "Created" },
              ].map((col) => (
                <th
                  key={col.field}
                  onClick={() => col.sortable !== false && onSort && onSort(col.field)}
                  className={`px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                    col.sortable !== false && onSort
                      ? "cursor-pointer hover:bg-purple-100 transition-colors"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable !== false && onSort && getSortIcon(col.field) && (
                      <span>{getSortIcon(col.field)}</span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role.role_id} className="hover:bg-purple-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                      <Users className="text-white" size={20} />
                    </div>
                    <div className="font-semibold text-gray-900">{role.role_name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                  {role.description || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs"
                    title={JSON.stringify(role.permissions, null, 2)}
                  >
                    {getPermissionsSummary(role.permissions)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
                    <Users size={14} />
                    {role.user_count || 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(role.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onView(role)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => onEdit(role)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      title="Edit Role"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(role.role_id)}
                      disabled={role.user_count > 0}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        role.user_count > 0
                          ? `Cannot delete: ${role.user_count} user(s) assigned`
                          : "Delete Role"
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700 font-medium">
            Page <span className="font-bold">{currentPage}</span> of{" "}
            <span className="font-bold">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default RoleList;
