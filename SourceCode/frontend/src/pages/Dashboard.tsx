import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Activity,
  RefreshCw,
} from "lucide-react";

interface DashboardMetrics {
  summary: {
    totalClaims: number;
    totalCharge: number;
    rejectionRate: number;
  };
  claimsByStatus: Array<{ claim_status: string; count: string }>;
  validationMetrics: Array<{ validation_status: string; count: string }>;
  topErrors: Array<{ rule_name: string; error_count: string }>;
  claimsByPayer: Array<{
    payer_name: string;
    claim_count: string;
    total_charge: string;
  }>;
  claimsByFacility: Array<{
    facility_name: string;
    claim_count: string;
    failed_count: string;
  }>;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    if (metrics) {
      setRefreshing(true);
    }
    try {
      const response = await axios.get("/api/v1/dashboard/metrics");
      setMetrics(response.data);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600 font-medium">No data available</p>
          <button onClick={fetchMetrics} className="mt-4 btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Claims",
      value: metrics.summary.totalClaims.toLocaleString(),
      icon: FileText,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      change: "+12%",
      changePositive: true,
    },
    {
      title: "Total Charges",
      value: `$${metrics.summary.totalCharge.toLocaleString()}`,
      icon: DollarSign,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      change: "+8%",
      changePositive: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600">
            Overview of your claims processing analytics
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} size={18} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="card shadow-lg border border-gray-200 hover:shadow-xl transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mb-2">
                    {stat.value}
                  </p>
                  <div className="flex items-center gap-1">
                    <TrendingUp
                      className={
                        stat.changePositive ? "text-green-600" : "text-red-600"
                      }
                      size={16}
                    />
                    <span
                      className={`text-sm font-medium ${
                        stat.changePositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {stat.change}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      vs last month
                    </span>
                  </div>
                </div>
                <div className={`${stat.bgColor} p-4 rounded-xl`}>
                  <Icon className={stat.iconColor} size={28} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims by Status */}
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Activity className="text-primary-600" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Claims by Status
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={metrics.claimsByStatus.map((item) => ({
                  name: item.claim_status,
                  value: parseInt(item.count),
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {metrics.claimsByStatus.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Claims by Payer */}
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-purple-600" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Claims by Payer
            </h2>
          </div>
          <div className="space-y-4">
            {metrics.claimsByPayer.slice(0, 5).map((payer, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:from-gray-100 hover:to-gray-50 transition-all"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {payer.payer_name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    $
                    {parseFloat(payer.total_charge).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {payer.claim_count} claims
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Claims by Facility */}
        <div className="card shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Claims by Facility
            </h2>
          </div>
          <div className="space-y-4">
            {metrics.claimsByFacility.slice(0, 5).map((facility, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg hover:from-gray-100 hover:to-gray-50 transition-all"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {facility.facility_name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {facility.failed_count} failed / {facility.claim_count}{" "}
                    total
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    {facility.claim_count} claims
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card shadow-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/upload")}
            className="p-5 border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-left group cursor-pointer"
          >
            <FileText
              className="text-gray-600 group-hover:text-primary-600 mb-3 transition-colors"
              size={28}
            />
            <p className="font-semibold text-gray-900 mb-1">
              Upload New Claims
            </p>
            <p className="text-xs text-gray-600">Process new 837 files</p>
          </button>
          <button
            onClick={() => navigate("/upload/history")}
            className="p-5 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left group cursor-pointer"
          >
            <CheckCircle
              className="text-gray-600 group-hover:text-green-600 mb-3 transition-colors"
              size={28}
            />
            <p className="font-semibold text-gray-900 mb-1">
              Review Validations
            </p>
            <p className="text-xs text-gray-600">Check validation results</p>
          </button>
          <button
            onClick={() => navigate("/claims")}
            className="p-5 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left group cursor-pointer"
          >
            <Activity
              className="text-gray-600 group-hover:text-purple-600 mb-3 transition-colors"
              size={28}
            />
            <p className="font-semibold text-gray-900 mb-1">View All Claims</p>
            <p className="text-xs text-gray-600">Browse claim history</p>
          </button>
        </div>
      </div>
    </div>
  );
}
