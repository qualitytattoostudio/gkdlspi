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
import { Plus, Search, CheckCircle, AlertTriangle, Trash2, Truck, Download, ShieldAlert, Navigation } from 'lucide-react';
import { format, isAfter, subDays, subMonths, isBefore, addDays } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function FleetPage() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [regNum, setRegNum] = useState('');
  const [vehicleType, setVehicleType] = useState('Transport Truck');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('active');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [fitnessExpiry, setFitnessExpiry] = useState('');

  useEffect(() => {
    async function fetchFleetData() {
      setLoading(true);
      try {
        const { data: profData } = await supabase.from('profiles').select('id, full_name, role');
        setEmployees(profData || []);
        if (profData && profData.length > 0) setDriverId(profData[0].id);

        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => {
          if (p.id) profileMap.set(p.id, p.full_name || 'Assigned Staff');
        });

        const [vehRes, alertRes] = await Promise.all([
          supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
          supabase.from('tracking_alerts').select('*, profiles!tracking_alerts_user_id_fkey(full_name)').order('created_at', { ascending: false }).limit(50)
        ]);

        if (vehRes.error) throw vehRes.error;

        const mappedVehicles = (vehRes.data || []).map(v => ({
          ...v,
          driver_name: profileMap.get(v.current_driver_id) || 'Unassigned'
        }));

        setVehicles(mappedVehicles);
        setAlerts(alertRes.data || []);
      } catch (err) {
        console.error('Error fetching fleet:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFleetData();
  }, [supabase]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const newVehicle = {
      registration_number: regNum,
      vehicle_type: vehicleType,
      brand,
      model,
      current_driver_id: driverId || null,
      status,
      insurance_expiry: insuranceExpiry || null,
      fitness_expiry: fitnessExpiry || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from('vehicles').insert([newVehicle]).select('*').single();
      if (error) throw error;
      
      const driverName = employees.find(e => e.id === driverId)?.full_name || 'Unassigned';
      setVehicles([{ ...data, driver_name: driverName }, ...vehicles]);
      playSuccess();
      toast.success('Vehicle Registered', 'New fleet vehicle added successfully.');
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Registration Failed', 'Could not register vehicle.');
    }

    setIsModalOpen(false);
    setRegNum('');
    setBrand('');
    setModel('');
    setInsuranceExpiry('');
    setFitnessExpiry('');
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      setVehicles(vehicles.filter(v => v.id !== id));
      playSuccess();
      toast.success('Vehicle Deleted', 'The fleet asset has been removed.');
    } catch (err) {
      playError();
      toast.error('Deletion Failed', 'Could not delete the vehicle.');
    }
  };

  const resolveAlert = async (id: string) => {
    try {
      const { error } = await supabase.from('tracking_alerts').update({ resolved: true }).eq('id', id);
      if (error) throw error;
      setAlerts(alerts.map(a => a.id === id ? { ...a, resolved: true } : a));
      playSuccess();
      toast.success('Alert Resolved', 'The tracking alert has been dismissed.');
    } catch (err) {
      playError();
      toast.error('Action Failed', 'Could not resolve the alert.');
    }
  };

  const resolveAllAlerts = async () => {
    try {
      const unresolvedIds = alerts.filter(a => !a.resolved).map(a => a.id);
      if (unresolvedIds.length === 0) {
        toast.info('No Pending Alerts', 'All tracking alerts are already resolved.');
        return;
      }
      const { error } = await supabase.from('tracking_alerts').update({ resolved: true }).in('id', unresolvedIds);
      if (error) throw error;
      setAlerts(alerts.map(a => ({ ...a, resolved: true })));
      playSuccess();
      toast.success('All Alerts Resolved', 'All pending tracking alerts have been dismissed.');
    } catch (err) {
      playError();
      toast.error('Action Failed', 'Could not resolve all alerts.');
    }
  };

  const getStatusBadge = (st: string) => {
    let variant: BadgeVariant = 'neutral';
    if (st === 'active' || st === 'operational') variant = 'success';
    if (st === 'maintenance') variant = 'warning';
    if (st === 'inactive') variant = 'error';
    return <NeuBadge variant={variant}>{st || 'active'}</NeuBadge>;
  };

  const getExpiryWarning = (dateStr: string) => {
    if (!dateStr) return <span className="text-neu-muted text-xs">Not Set</span>;
    const expiryDate = new Date(dateStr);
    const thirtyDaysFromNow = addDays(new Date(), 30);
    if (isBefore(expiryDate, new Date())) {
      return <span className="text-red-500 font-bold text-xs flex items-center gap-1"><AlertTriangle size={12}/> EXPIRED</span>;
    }
    if (isBefore(expiryDate, thirtyDaysFromNow)) {
      return <span className="text-amber-500 font-bold text-xs flex items-center gap-1"><AlertTriangle size={12}/> {format(expiryDate, 'MMM dd, yyyy')}</span>;
    }
    return <span className="text-neu-fg text-xs">{format(expiryDate, 'MMM dd, yyyy')}</span>;
  };

  const filtered = vehicles.filter(v => {
    const matchesSearch = 
      (v.registration_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.vehicle_type || '').toLowerCase().includes(search.toLowerCase()) ||
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
      'Registration': v.registration_number,
      'Type': v.vehicle_type,
      'Brand/Model': `${v.brand} ${v.model}`,
      'Driver': v.driver_name,
      'Status': v.status,
      'Insurance Expiry': v.insurance_expiry,
      'Fitness Expiry': v.fitness_expiry,
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `fleet_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Fleet CSV downloaded.');
  };

  const activeCount = vehicles.filter(v => v.status === 'active' || v.status === 'operational').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
  const unresolvedAlerts = alerts.filter(a => !a.resolved).length;

  const columns = [
    {
      accessorKey: 'registration_number',
      header: 'Reg Number',
      cell: (info: any) => <span className="font-mono text-xs font-bold text-neu-accent">{info.getValue() || 'N/A'}</span>
    },
    {
      accessorKey: 'vehicle_type',
      header: 'Category & Details',
      cell: (info: any) => (
        <div>
          <p className="font-bold text-sm text-neu-fg">{info.getValue() || 'Vehicle'}</p>
          <p className="text-[10px] text-neu-muted">{info.row.original.brand} {info.row.original.model}</p>
        </div>
      )
    },
    {
      accessorKey: 'driver_name',
      header: 'Assigned Driver',
      cell: (info: any) => <span className="font-medium">{info.getValue()}</span>
    },
    {
      accessorKey: 'insurance_expiry',
      header: 'Insurance',
      cell: (info: any) => getExpiryWarning(info.getValue())
    },
    {
      accessorKey: 'fitness_expiry',
      header: 'Fitness Cert',
      cell: (info: any) => getExpiryWarning(info.getValue())
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
          className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all" 
          title="Delete Vehicle"
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Fleet & Vehicles</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Fleet & Vehicles Management</h2>
          <p className="text-neu-muted text-sm">Oversight for company vehicles, driver assignments, and live alerts.</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Register Vehicle
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Fleet Size" value={vehicles.length} icon={Truck} />
        <StatCard title="Active & Deployed" value={activeCount} icon={CheckCircle} />
        <StatCard title="In Maintenance" value={maintenanceCount} icon={AlertTriangle} />
        <StatCard title="Unresolved Alerts" value={unresolvedAlerts} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicles Table (Spans 2 columns on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="w-full md:max-w-md">
              <NeuInput 
                placeholder="Search reg number, category, or driver..." 
                icon={<Search size={18} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <NeuSelect 
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                options={[
                  { label: 'All Time', value: 'all' },
                  { label: 'Added This Month', value: 'month' },
                ]}
              />
              <NeuButton variant="secondary" onClick={exportCSV} className="shrink-0">
                <Download size={18} /> Export
              </NeuButton>
            </div>
          </NeuCard>

          {filtered.length === 0 ? (
            <NeuCard>
              <EmptyState 
                icon={Truck} 
                title="No vehicles found" 
                description="Register a new vehicle to start tracking your fleet."
                action={
                  <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> Add Vehicle
                  </NeuButton>
                }
              />
            </NeuCard>
          ) : (
            <NeuTable data={filtered} columns={columns} />
          )}
        </div>

        {/* Live GPS Tracking Alerts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Navigation size={20} className="text-neu-accent"/> Live V-Trak Alerts
            </h3>
            {unresolvedAlerts > 0 && (
              <button 
                onClick={resolveAllAlerts}
                className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all cursor-pointer"
              >
                Resolve All ({unresolvedAlerts})
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
            {alerts.length === 0 ? (
              <NeuCard className="p-8 text-center">
                <ShieldAlert size={28} className="mx-auto text-neu-muted opacity-40 mb-2" />
                <p className="font-bold text-sm text-neu-fg">No Tracking Alerts</p>
                <p className="text-xs text-neu-muted">All vehicles are operating normally.</p>
              </NeuCard>
            ) : (
              alerts.map(alert => (
                <NeuCard key={alert.id} className={`p-4 border-l-4 ${alert.resolved ? 'border-l-neu-muted/20 opacity-60' : 'border-l-red-500 shadow-neu-inset-sm'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-neu-fg flex items-center gap-2">
                        {!alert.resolved && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        {alert.alert_type || 'GPS Deviation'}
                      </h4>
                      <p className="text-xs text-neu-muted mt-0.5">Staff: {alert.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-neu-muted mt-1">{format(new Date(alert.created_at), 'MMM dd, hh:mm a')}</p>
                    </div>
                    {!alert.resolved && (
                      <button 
                        onClick={() => resolveAlert(alert.id)}
                        className="text-[10px] font-bold uppercase tracking-wider text-neu-accent bg-neu-accent/10 px-2 py-1 rounded-lg hover:bg-neu-accent/20 transition-all"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </NeuCard>
              ))
            )}
          </div>
        </div>
      </div>

      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Fleet Vehicle">
        <form onSubmit={handleAddVehicle} className="space-y-4">
          <NeuInput label="Registration Number (License Plate)" placeholder="MH-12-AB-9988" value={regNum} onChange={(e) => setRegNum(e.target.value)} required />
          <NeuSelect 
            label="Vehicle Category" 
            options={[
              { label: 'Transport Truck', value: 'Transport Truck' },
              { label: 'Utility Van', value: 'Utility Van' },
              { label: 'Field Bike / Scooter', value: 'Scooter' },
              { label: 'Staff Car', value: 'Car' },
            ]} 
            value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <NeuInput label="Brand / Make" placeholder="Tata" value={brand} onChange={(e) => setBrand(e.target.value)} />
            <NeuInput label="Model" placeholder="Ace Gold" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <NeuSelect 
            label="Default Assigned Driver" 
            options={[{ label: 'Unassigned', value: '' }, ...employees.map(e => ({ label: `${e.full_name} (${e.role})`, value: e.id }))]} 
            value={driverId} onChange={(e) => setDriverId(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <NeuInput type="date" label="Insurance Expiry Date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} />
            <NeuInput type="date" label="Fitness/Reg Expiry Date" value={fitnessExpiry} onChange={(e) => setFitnessExpiry(e.target.value)} />
          </div>
          <NeuSelect 
            label="Operational Status" 
            options={[{ label: 'Active / Deployed', value: 'active' }, { label: 'In Maintenance', value: 'maintenance' }]} 
            value={status} onChange={(e) => setStatus(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</NeuButton>
            <NeuButton type="submit">Register Vehicle</NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
