import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Settings,
  LogOut,
  Menu,
  AlertCircle,
  ClipboardList,
  Building2,
  Building,
  CreditCard,
  Network,
  Users,
  ChevronDown,
  ChevronRight,
  Database,
} from "lucide-react";
import { useState } from "react";

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  children?: NavigationItem[];
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [masterMenuOpen, setMasterMenuOpen] = useState(true);

  const navigation: NavigationItem[] = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Claims", href: "/claims", icon: FileText },
    { name: "Upload", href: "/upload", icon: Upload },
    { name: "Validation Logs", href: "/upload/history", icon: AlertCircle },
    {
      name: "Master",
      icon: Database,
      children: [
        { name: "Providers", href: "/providers", icon: Building2 },
        { name: "Payers", href: "/payers", icon: CreditCard },
        { name: "Facilities", href: "/facilities", icon: Building },
        { name: "Trading Partners", href: "/trading-partners", icon: Network },
      ],
    },
    { name: "Rules", href: "/rules", icon: Settings },
    { name: "User Management", href: "/user-management", icon: Users },
  ];

  const isActive = (path: string) => location.pathname === path;

  const isParentActive = (children?: NavigationItem[]) => {
    if (!children) return false;
    return children.some((child) => child.href && isActive(child.href));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 bg-primary-600">
            <h1 className="text-xl font-bold text-white">Claim Accelerator</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-white lg:hidden"
            >
              <Menu size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;

              // Parent menu with children
              if (item.children) {
                const isExpanded = masterMenuOpen;
                const hasActiveChild = isParentActive(item.children);

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => setMasterMenuOpen(!masterMenuOpen)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                        hasActiveChild
                          ? "bg-primary-50 text-primary-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center">
                        <Icon size={20} className="mr-3" />
                        {item.name}
                      </div>
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>

                    {/* Submenu */}
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          return (
                            <Link
                              key={child.name}
                              to={child.href!}
                              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                                isActive(child.href!)
                                  ? "bg-primary-50 text-primary-700 font-medium"
                                  : "text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              <ChildIcon size={18} className="mr-3" />
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular menu item
              return (
                <Link
                  key={item.name}
                  to={item.href!}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.href!)
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-medium">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user?.roles[0]}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-200 ${
          sidebarOpen ? "lg:pl-64" : ""
        }`}
      >
        {/* Top bar */}
        <header className="bg-white shadow-sm">
          <div className="flex items-center justify-between h-16 px-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
