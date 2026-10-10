import React, { createContext, useContext, useState, useEffect } from 'react';
import { DatasetItem, DatasetProfile } from '../types';
import { datasetsApi, profilingApi } from '../services/api';
import { useAuth } from './AuthContext';

interface DatasetContextType {
  datasets: DatasetItem[];
  selectedDataset: DatasetItem | null;
  profile: DatasetProfile | null;
  isLoadingDatasets: boolean;
  isLoadingProfile: boolean;
  useCleanedVersion: boolean;
  setUseCleanedVersion: (val: boolean) => void;
  selectDatasetById: (id: string) => void;
  refreshDatasets: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loadSampleDataset: (sampleType: 'churn' | 'housing' | 'segmentation') => Promise<DatasetItem>;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(() =>
    localStorage.getItem('datapilot_active_dataset_id')
  );
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [useCleanedVersion, setUseCleanedVersion] = useState<boolean>(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);

  const fetchDatasets = async () => {
    if (!user) {
      setDatasets([]);
      setSelectedDataset(null);
      setProfile(null);
      return;
    }
    setIsLoadingDatasets(true);
    try {
      const list = await datasetsApi.list();
      setDatasets(list);

      // Restore active dataset if in list, otherwise select first or keep null
      if (list.length > 0) {
        const found = list.find((d) => d.id === selectedDatasetId) || list[0];
        setSelectedDataset(found);
        setSelectedDatasetId(found.id);
        localStorage.setItem('datapilot_active_dataset_id', found.id);
      } else {
        setSelectedDataset(null);
        setProfile(null);
      }
    } catch (e) {
      console.error('Failed to load datasets', e);
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [user]);

  // Fetch profile whenever selectedDataset or useCleanedVersion changes
  const fetchProfile = async () => {
    if (!selectedDataset) {
      setProfile(null);
      return;
    }
    setIsLoadingProfile(true);
    try {
      const prof = await profilingApi.getProfile(selectedDataset.id, false, useCleanedVersion);
      setProfile(prof);
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [selectedDataset?.id, useCleanedVersion]);

  const selectDatasetById = (id: string) => {
    const found = datasets.find((d) => d.id === id);
    if (found) {
      setSelectedDataset(found);
      setSelectedDatasetId(found.id);
      localStorage.setItem('datapilot_active_dataset_id', found.id);
      setUseCleanedVersion(false);
    }
  };

  const loadSampleDataset = async (sampleType: 'churn' | 'housing' | 'segmentation') => {
    const newDs = await datasetsApi.loadSample(sampleType);
    await fetchDatasets();
    selectDatasetById(newDs.id);
    return newDs;
  };

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        selectedDataset,
        profile,
        isLoadingDatasets,
        isLoadingProfile,
        useCleanedVersion,
        setUseCleanedVersion,
        selectDatasetById,
        refreshDatasets: fetchDatasets,
        refreshProfile: fetchProfile,
        loadSampleDataset,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
};

export const useDataset = () => {
  const context = useContext(DatasetContext);
  if (!context) throw new Error('useDataset must be used within a DatasetProvider');
  return context;
};
