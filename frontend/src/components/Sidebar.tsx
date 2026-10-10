import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  BarChart3,
  Cpu,
  Bot,
  FileCheck2,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';

export const Sidebar: React.FC = () => {
  const { selectedDataset } = useDataset();

  const navItems = [
    { to: '/dashboard', label: 'Executive Overview', icon: LayoutDashboard },
    { to: '/datasets', label: 'Datasets & Upload', icon: FolderOpen },
    { to: '/cleaning', label: 'Data Cleaning Studio', icon: Sparkles },
    { to: '/eda', label: 'Exploratory Analysis', icon: BarChart3 },
    { to: '/ml', label: 'Machine Learning Lab', icon: Cpu },
    { to: '/ai', label: 'Gemini AI Assistant', icon: Bot },
    { to: '/reports', label: 'Reports & Export', icon: FileCheck2 },
  ];

  return (
    <aside className="w-64 bg-slate-950/60 border-r border-slate-800/80 flex flex-col justify-between py-5 px-3 min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        {/* Navigation Links */}
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Workspaces
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-900/60 to-slate-900 text-indigo-300 border border-indigo-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Selected Dataset Mini Card */}
        {selectedDataset && (
          <div className="mx-1 p-3 rounded-xl bg-slate-900/90 border border-slate-800/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Active Dataset
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
            </div>
            <p className="text-xs font-medium text-slate-200 truncate" title={selectedDataset.name}>
              {selectedDataset.name}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
              <span>{selectedDataset.row_count.toLocaleString()} rows</span>
              <span className="font-semibold text-teal-400">
                Score: {Math.round(selectedDataset.quality_score)}/100
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 pt-3 border-t border-slate-800/60">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>DataPilot AI v1.0</span>
          <span className="text-indigo-400 font-mono">Gemini 2.0</span>
        </div>
      </div>
    </aside>
  );
};
