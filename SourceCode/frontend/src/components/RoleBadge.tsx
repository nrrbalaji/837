import React from "react";

interface RoleBadgeProps {
  roleName: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "success" | "warning" | "danger";
}

const RoleBadge: React.FC<RoleBadgeProps> = ({
  roleName,
  size = "md",
  variant = "default"
}) => {
  // Map role names to variants for auto-coloring
  const getVariantForRole = (role: string): string => {
    const roleLower = role.toLowerCase();
    if (roleLower.includes("admin")) return "danger";
    if (roleLower.includes("manager") || roleLower.includes("supervisor")) return "warning";
    if (roleLower.includes("user") || roleLower.includes("viewer")) return "default";
    return "primary";
  };

  const autoVariant = variant === "default" ? getVariantForRole(roleName) : variant;

  const variantStyles = {
    default: "bg-gray-100 text-gray-700 border-gray-200",
    primary: "bg-blue-100 text-blue-700 border-blue-200",
    success: "bg-green-100 text-green-700 border-green-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    danger: "bg-red-100 text-red-700 border-red-200",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${variantStyles[autoVariant as keyof typeof variantStyles]} ${sizeStyles[size]}`}
    >
      {roleName}
    </span>
  );
};

export default RoleBadge;
