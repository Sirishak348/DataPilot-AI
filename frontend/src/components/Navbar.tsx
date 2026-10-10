import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Database,
  Layers,
  Sparkles,
  LogOut,
  User as UserIcon,
  ChevronDown,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDataset } from '../context/DatasetContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { datasets, selectedDataset, selectDatasetById, useCleanedVersion, setUseCleanedVersion } = useDataset();
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-teal-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center group-hover:bg-slate-900 transition-colors">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
              DataPilot <span className="text-teal-400 text-xs uppercase px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-800/60 font-semibold tracking-wider ml-1">AI</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Active Dataset Selector */}
      {user && (
        <div className="hidden md:flex items-center space-x-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5">
          <Database className="w-4 h-4 text-indigo-400" />
          <span className="text-xs text-slate-400 font-medium">Dataset:</span>
          
          {datasets.length > 0 ? (
            <div className="relative">
              <select
                value={selectedDataset?.id || ''}
                onChange={(e) => selectDatasetById(e.target.value)}
                className="bg-slate-950 text-slate-200 text-xs rounded-lg px-2.5 py-1 pr-7 border border-slate-700/60 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer font-medium"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.row_count.toLocaleString()} rows)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <span className="text-xs text-amber-400/90 italic">No dataset uploaded yet</span>
          )}

          {/* Toggle Cleaned vs Original if cleaned version exists */}
          {selectedDataset?.has_cleaned_version && (
            <div className="flex items-center ml-2 pl-2 border-l border-slate-800 space-x-1">
              <button
                onClick={() => setUseCleanedVersion(false)}
                className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                  !useCleanedVersion
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Raw
              </button>
              <button
                onClick={() => setUseCleanedVersion(true)}
                className={`text-[11px] px-2 py-0.5 rounded-md flex items-center space-x-1 transition-colors ${
                  useCleanedVersion
                    ? 'bg-teal-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Cleaned</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Right: Actions & User Profile */}
      <div className="flex items-center space-x-3">
        {user ? (
          <>
            {selectedDataset && (
              <button
                onClick={() => navigate('/reports')}
                className="hidden sm:flex items-center space-x-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 px-3 py-1.5 rounded-lg border border-slate-700/60 transition"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export PDF</span>
              </button>
            )}

            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                {user.email.charAt(0)}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                  {user.full_name || user.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-teal-400 font-mono">
                  {user.email === 'demo@datapilot.ai' ? 'Demo Account' : 'Active'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <Link
              to="/auth"
              className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition"
            >
              Sign In
            </Link>
            <Link
              to="/auth?tab=register"
              className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg shadow-sm shadow-indigo-600/30 transition flex items-center space-x-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Started</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
