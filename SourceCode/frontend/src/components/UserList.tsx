import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Edit, Trash2, Shield, Eye, ChevronLeft, ChevronRight, Building } from "lucide-react";
import RoleBadge from "./RoleBadge";

interface User {
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  last_login: string | null;
  roles: Array<{ role_id: string; role_name: string }>;
  facilities?: Array<{ facility_id: string; facility_code: string; facility_name: string }>;
}

interface UserListProps {
  users: User[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  sortField: string;
  sortOrder: "asc" | "desc";
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  onEdit: (user: User) => void;
  onView: (user: User) => void;
  onDelete: (userId: string) => void;
  onManageRoles: (user: User) => void;
}

const UserList: React.FC<UserListProps> = ({
  users,
  loading,
  currentPage,
  totalPages,
  sortField,
  sortOrder,
  onPageChange,
  onSort,
  onEdit,
  onView,
  onDelete,
  onManageRoles,
}) => {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-12 text-center">
        <Shield className="mx-auto text-gray-400 mb-4" size={48} />
        <p className="text-gray-700 font-medium mb-2">No users found</p>
        <p className="text-sm text-gray-500">Try adjusting your filters or add a new user</p>
      </div>
    );
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? "↑" : "↓";
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <tr>
              {[
                { field: "username", label: "Username" },
                { field: "email", label: "Email" },
                { field: "first_name", label: "Name" },
                { field: "is_active", label: "Status" },
                { field: "last_login", label: "Last Login" },
                { field: "roles", label: "Roles", sortable: false },
                { field: "facilities", label: "Facilities", sortable: false },
              ].map((col) => (
                <th
                  key={col.field}
                  onClick={() => col.sortable !== false && onSort(col.field)}
                  className={`px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${
                    col.sortable !== false ? "cursor-pointer hover:bg-blue-100 transition-colors" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable !== false && getSortIcon(col.field) && (
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
            {users.map((user) => (
              <tr key={user.user_id} className="hover:bg-blue-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {user.first_name?.[0] || user.username[0].toUpperCase()}
                        {user.last_name?.[0] || ""}
                      </span>
                    </div>
                    <div className="font-semibold text-gray-900">{user.username}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {user.first_name && user.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : "-"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      user.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {user.last_login ? (
                    <span title={new Date(user.last_login).toLocaleString()}>
                      {formatDistanceToNow(new Date(user.last_login), { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-gray-400">Never</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <RoleBadge key={role.role_id} roleName={role.role_name} size="sm" />
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">No roles</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {user.facilities && user.facilities.length > 0 ? (
                      <>
                        {user.facilities.slice(0, 2).map((facility) => (
                          <span
                            key={facility.facility_id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded border border-green-200"
                            title={`${facility.facility_name} (${facility.facility_code})`}
                          >
                            <Building size={12} />
                            {facility.facility_code}
                          </span>
                        ))}
                        {user.facilities.length > 2 && (
                          <span
                            className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded"
                            title={user.facilities
                              .slice(2)
                              .map((f) => f.facility_name)
                              .join(", ")}
                          >
                            +{user.facilities.length - 2} more
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">All facilities</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onView(user)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => onEdit(user)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      title="Edit User"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => onManageRoles(user)}
                      className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                      title="Manage Roles"
                    >
                      <Shield size={18} />
                    </button>
                    <button
                      onClick={() => onDelete(user.user_id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Deactivate User"
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
      {totalPages > 1 && (
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

export default UserList;
