'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuTable } from '@/components/neu/NeuTable';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { NeuModal } from '@/components/neu/NeuModal';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { StatCard } from '@/components/neu/StatCard';
import { Wrench, Plus, Search, CheckCircle, AlertTriangle, Package, Trash2, Truck, Download, Filter } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function AssetsPage() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [regNum, setRegNum] = useState('');
  const [vehicleType, setVehicleType] = useState('Utility Van');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    async function fetchAssetsData() {
      setLoading(true);

      try {
        // Fetch profiles map
        const { data: profData } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
        setEmployees(profData || []);
        if (profData && profData.length > 0) setDriverId(profData[0].id);

        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => {
          if (p.id) profileMap.set(p.id, p.full_name || 'Assigned Staff');
        });

        // Query original database table: vehicles
        const { data: vehData, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (vehData || []).map(v => ({
          ...v,
          driver_name: profileMap.get(v.current_driver_id) || 'Unassigned'
        }));

        setVehicles(mapped);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAssetsData();
  }, [supabase]);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle = {
      registration_number: regNum || `AST-${Math.floor(1000 + Math.random() * 9000)}`,
      vehicle_type: vehicleType,
      brand: brand || 'Standard',
      model: model || 'Pro',
      current_driver_id: driverId || null,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert([newVehicle])
        .select('*');

      if (!error && data) {
        const driverName = employees.find(e => e.id === driverId)?.full_name || 'Unassigned';
        setVehicles([{
          ...data[0],
          driver_name: driverName
        }, ...vehicles]);
        playSuccess();
        toast.success('Asset Registered', 'The vehicle/asset has been added successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Registration Failed', 'Could not register asset. Please try again.');
    }

    setIsModalOpen(false);
    setRegNum('');
    setBrand('');
    setModel('');
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      setVehicles(vehicles.filter(v => v.id !== id));
      playSuccess();
      toast.success('Asset Deleted', 'The vehicle/asset has been removed.');
    } catch (err) {
      playError();
      toast.error('Deletion Failed', 'Could not delete the asset.');
    }
  };

  const getStatusBadge = (st: string) => {
    let variant: BadgeVariant = 'neutral';
    if (st === 'active' || st === 'operational') variant = 'success';
    if (st === 'maintenance') variant = 'warning';
    if (st === 'inactive') variant = 'error';
    return <NeuBadge variant={variant}>{st || 'active'}</NeuBadge>;
  };

  const filtered = vehicles.filter(v => {
    const matchesSearch = 
      (v.registration_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.vehicle_type || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.brand || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.driver_name || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(v.created_at), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(v.created_at), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(v.created_at), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filtered.map(v => ({
      'Registration/Tag': v.registration_number,
      'Category': v.vehicle_type,
      'Brand': v.brand,
      'Model': v.model,
      'Assigned Staff': v.driver_name,
      'Status': v.status,
      'Date Registered': format(new Date(v.created_at), 'MMM dd, yyyy')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assets_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const activeCount = vehicles.filter(v => v.status === 'active' || v.status === 'operational').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;

  const columns = [
    {
      accessorKey: 'registration_number',
      header: 'Reg No. / Asset Tag',
      cell: (info: any) => <span className="font-mono text-xs font-bold text-neu-accent">{info.getValue() || 'AST-1001'}</span>
    },
    {
      accessorKey: 'vehicle_type',
      header: 'Asset Category',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Utility Asset'}</span>
    },
    {
      accessorKey: 'brand',
      header: 'Brand & Model',
      cell: (info: any) => <span className="font-medium text-neu-muted">{info.row.original.brand} {info.row.original.model}</span>
    },
    {
      accessorKey: 'driver_name',
      header: 'Assigned Driver / Staff',
      cell: (info: any) => info.getValue() || 'Unassigned'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => getStatusBadge(info.getValue())
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => (
        <button 
          onClick={() => handleDeleteVehicle(info.row.original.id)} 
          className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer" 
          title="Delete Asset"
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Asset & Vehicle Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Asset & Vehicle Management</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `vehicles` table ({vehicles.length} assets registered).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Register New Asset
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Registered Assets" value={vehicles.length} icon={Truck} />
        <StatCard title="Active Operational" value={activeCount} icon={CheckCircle} />
        <StatCard title="Under Maintenance" value={maintenanceCount} icon={AlertTriangle} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search reg number, brand, category, or driver..." 
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <NeuSelect 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              options={[
                { label: 'All Time', value: 'all' },
                { label: 'Added Today', value: 'today' },
                { label: 'Added This Week', value: 'week' },
                { label: 'Added This Month', value: 'month' },
              ]}
            />
          </div>
          <NeuButton variant="secondary" onClick={exportCSV} className="shrink-0">
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </NeuButton>
        </div>
      </NeuCard>

      {filtered.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Wrench} 
            title="No assets or vehicles registered" 
            description="No asset entries in the database matching your search. Register a new asset to get started."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Register New Asset
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Add Asset / Vehicle Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Asset / Vehicle">
        <form onSubmit={handleAddAsset} className="space-y-4">
          <NeuInput 
            label="Registration Number / Asset Tag" 
            placeholder="e.g. MH-12-AB-9988" 
            value={regNum} 
            onChange={(e) => setRegNum(e.target.value)} 
          />
          <NeuSelect 
            label="Asset Category" 
            options={[
              { label: 'Utility Van', value: 'Utility Van' },
              { label: 'Transport Truck', value: 'Transport Truck' },
              { label: 'Field Scooter / Bike', value: 'Scooter' },
              { label: 'Industrial Scrubber Machine', value: 'Scrubber Machine' },
              { label: 'High Pressure Washer', value: 'Pressure Washer' },
            ]} 
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <NeuInput 
              label="Brand / Manufacturer" 
              placeholder="e.g. Tata / Kärcher" 
              value={brand} 
              onChange={(e) => setBrand(e.target.value)} 
            />
            <NeuInput 
              label="Model" 
              placeholder="e.g. Ace Gold / HD 6/15" 
              value={model} 
              onChange={(e) => setModel(e.target.value)} 
            />
          </div>
          <NeuSelect 
            label="Assign Current Driver / Executive" 
            options={[
              { label: 'Unassigned', value: '' },
              ...employees.map(e => ({ label: `${e.full_name || 'Staff'} (${e.role || 'Member'})`, value: e.id }))
            ]} 
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          />
          <NeuSelect 
            label="Operational Status" 
            options={[
              { label: 'Active / Operational', value: 'active' },
              { label: 'In Maintenance', value: 'maintenance' },
              { label: 'Inactive / Retired', value: 'inactive' },
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Register Asset Entry
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
