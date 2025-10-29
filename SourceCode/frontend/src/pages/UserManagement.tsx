import { useState, useEffect } from "react";
import { Users, Shield, Plus, Search, Filter, Download, Upload } from "lucide-react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import UserList from "../components/UserList";
import UserForm from "../components/UserForm";
import RoleList from "../components/RoleList";
import RoleForm from "../components/RoleForm";
import RoleAssignmentDrawer from "../components/RoleAssignmentDrawer";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

interface User {
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  last_login: string | null;
  roles: Array<{ role_id: string; role_name: string }>;
}

interface Role {
  role_id: string;
  role_name: string;
  description: string;
  permissions: any;
  user_count: number;
  created_at: string;
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // User state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSortField, setUserSortField] = useState("created_at");
  const [userSortOrder, setUserSortOrder] = useState<"asc" | "desc">("desc");
  const [userFilters, setUserFilters] = useState({
    search: "",
    role: "",
    isActive: "",
  });

  // Role state
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Modal/Drawer state
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showRoleDrawer, setShowRoleDrawer] = useState(false);
  const [userFormMode, setUserFormMode] = useState<"add" | "edit" | "view">("add");
  const [roleFormMode, setRoleFormMode] = useState<"add" | "edit" | "view">("add");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchRoles();
    }
  }, [activeTab, userCurrentPage, userSortField, userSortOrder, userFilters]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: userCurrentPage.toString(),
        limit: "20",
        sortField: userSortField,
        sortOrder: userSortOrder,
        ...userFilters,
      });

      const response = await axios.get(`${API_BASE}/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers(response.data.users || []);
      setUserTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRoles(response.data.roles || []);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      toast.error("Failed to fetch roles");
    } finally {
      setRolesLoading(false);
    }
  };

  const handleUserSort = (field: string) => {
    if (userSortField === field) {
      setUserSortOrder(userSortOrder === "asc" ? "desc" : "asc");
    } else {
      setUserSortField(field);
      setUserSortOrder("asc");
    }
  };

  const handleAddUser = () => {
    setUserFormMode("add");
    setSelectedUser(null);
    setShowUserForm(true);
  };

  const handleEditUser = (user: User) => {
    setUserFormMode("edit");
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleViewUser = (user: User) => {
    setUserFormMode("view");
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("User deactivated successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to deactivate user");
    }
  };

  const handleManageRoles = (user: User) => {
    setSelectedUser(user);
    setShowRoleDrawer(true);
  };

  const handleAddRole = () => {
    setRoleFormMode("add");
    setSelectedRole(null);
    setShowRoleForm(true);
  };

  const handleEditRole = (role: Role) => {
    setRoleFormMode("edit");
    setSelectedRole(role);
    setShowRoleForm(true);
  };

  const handleViewRole = (role: Role) => {
    setRoleFormMode("view");
    setSelectedRole(role);
    setShowRoleForm(true);
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Role deleted successfully");
      fetchRoles();
    } catch (error: any) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.error);
      } else {
        toast.error("Failed to delete role");
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <span>Admin</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">User Management</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage system users, roles, and permissions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast("Export feature coming soon!", { icon: "📤" })}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-purple-400 transition-all shadow-sm"
            >
              <Download size={18} />
              Export
            </button>
            <button
              onClick={() => toast("Import feature coming soon!", { icon: "📥" })}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-purple-400 transition-all shadow-sm"
            >
              <Upload size={18} />
              Import
            </button>
            {activeTab === "users" ? (
              <button
                onClick={handleAddUser}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-800 transition-all shadow-md hover:shadow-lg"
              >
                <Plus size={20} />
                Add User
              </button>
            ) : (
              <button
                onClick={handleAddRole}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-800 transition-all shadow-md hover:shadow-lg"
              >
                <Plus size={20} />
                Add Role
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "users"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <Users size={18} />
              Users
            </button>
            <button
              onClick={() => setActiveTab("roles")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "roles"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              <Shield size={18} />
              Roles
            </button>
          </nav>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === "users" && (
        <>
          {/* Search/Filter Panel */}
          <div className="card shadow-lg border border-gray-200 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="text-purple-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">Search & Filter</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Username, email, name..."
                    value={userFilters.search}
                    onChange={(e) =>
                      setUserFilters({ ...userFilters, search: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={userFilters.role}
                  onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                >
                  <option value="">All Roles</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={userFilters.isActive}
                  onChange={(e) =>
                    setUserFilters({ ...userFilters, isActive: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="card shadow-lg border border-gray-200 overflow-hidden">
            <UserList
              users={users}
              loading={usersLoading}
              currentPage={userCurrentPage}
              totalPages={userTotalPages}
              sortField={userSortField}
              sortOrder={userSortOrder}
              onPageChange={setUserCurrentPage}
              onSort={handleUserSort}
              onEdit={handleEditUser}
              onView={handleViewUser}
              onDelete={handleDeleteUser}
              onManageRoles={handleManageRoles}
            />
          </div>
        </>
      )}

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="card shadow-lg border border-gray-200 overflow-hidden">
          <RoleList
            roles={roles}
            loading={rolesLoading}
            onEdit={handleEditRole}
            onView={handleViewRole}
            onDelete={handleDeleteRole}
          />
        </div>
      )}

      {/* Modals & Drawers */}
      {showUserForm && (
        <UserForm
          mode={userFormMode}
          userData={selectedUser}
          onClose={() => setShowUserForm(false)}
          onSuccess={() => {
            fetchUsers();
            setShowUserForm(false);
          }}
        />
      )}

      {showRoleForm && (
        <RoleForm
          mode={roleFormMode}
          roleData={selectedRole}
          onClose={() => setShowRoleForm(false)}
          onSuccess={() => {
            fetchRoles();
            setShowRoleForm(false);
          }}
        />
      )}

      <RoleAssignmentDrawer
        isOpen={showRoleDrawer}
        user={selectedUser}
        onClose={() => setShowRoleDrawer(false)}
        onSuccess={() => {
          fetchUsers();
        }}
      />
    </div>
  );
}
