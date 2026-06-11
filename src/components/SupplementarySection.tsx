import React, { useState, useMemo, useEffect } from 'react';
import { PartOrder, User, Vehicle, PartsMasterItem } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Truck,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Printer,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Briefcase,
  HelpCircle,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface SupplementarySectionProps {
  parts: PartOrder[];
  partsMaster: PartsMasterItem[];
  vehicles: Vehicle[];
  currentUser: User;
  onSavePart: (p: PartOrder) => void;
  onDeletePart: (id: string) => void;
  addTrigger?: number;
  exportTrigger?: number;
}

interface SupplementaryFormRow {
  partNo: string;
  partName: string;
  qty: number;
  rate: number;
  insuranceStatus: 'Pending' | 'Approved' | 'Rejected';
  status: 'In Order' | 'In Transit' | 'Received';
  remarks: string;
}

export default function SupplementarySection({
  parts,
  partsMaster = [],
  vehicles = [],
  currentUser,
  onSavePart,
  onDeletePart,
  addTrigger = 0,
  exportTrigger = 0
}: SupplementarySectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('All');
  const [filterInsurance, setFilterInsurance] = useState('All');
  const [filterProcurement, setFilterProcurement] = useState('All');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  // Form Fields
  const [selectedVehicleReg, setSelectedVehicleReg] = useState('');
  // Multi-row rows for "Add More" feature
  const [formRows, setFormRows] = useState<SupplementaryFormRow[]>([
    { partNo: '', partName: '', qty: 1, rate: 0, insuranceStatus: 'Pending', status: 'In Order', remarks: '' }
  ]);

  // Inventory Catalog Search States within Form Row
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [catalogSearchText, setCatalogSearchText] = useState('');

  // Watch Trigger props from Parent Header buttons
  useEffect(() => {
    if (addTrigger > 0) {
      handleOpenAddModal();
    }
  }, [addTrigger]);

  useEffect(() => {
    if (exportTrigger > 0) {
      exportSupplementarySpreadsheet();
    }
  }, [exportTrigger]);

  const canWrite = currentUser.canWrite;
  const canDelete = currentUser.canDelete;

  // Filter Parts that are supplementary
  const supplementaryParts = useMemo(() => {
    return parts.filter(p => !p.isDeleted && p.isSupplementary);
  }, [parts]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCost = 0;
    let approvedCost = 0;

    supplementaryParts.forEach(p => {
      const rowCost = p.qty * (p.rate || 0);
      if (p.insuranceStatus === 'Approved') {
        approvedCount++;
        approvedCost += rowCost;
      } else if (p.insuranceStatus === 'Rejected') {
        rejectedCount++;
      } else {
        pendingCount++;
        pendingCost += rowCost;
      }
    });

    return {
      totalItems: supplementaryParts.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      pendingCost,
      approvedCost,
      totalCost: approvedCost + pendingCost
    };
  }, [supplementaryParts]);

  // Unique list of vehicles in supplementary parts for filtering
  const uniqueVehiclesWithSupp = useMemo(() => {
    const set = new Set<string>();
    supplementaryParts.forEach(p => {
      if (p.regNo) set.add(p.regNo.toUpperCase());
    });
    return Array.from(set).sort();
  }, [supplementaryParts]);

  // Filtered List
  const filteredList = useMemo(() => {
    return supplementaryParts.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' || [
        p.regNo,
        p.partNo || '',
        p.partName,
        p.remarks || '',
        p.orderNo || ''
      ].some(field => field.toLowerCase().includes(q));

      const matchVehicle = filterVehicle === 'All' || p.regNo.toUpperCase() === filterVehicle.toUpperCase();
      const matchInsurance = filterInsurance === 'All' || (p.insuranceStatus || 'Pending') === filterInsurance;
      const matchProcurement = filterProcurement === 'All' || p.status === filterProcurement;

      return matchSearch && matchVehicle && matchInsurance && matchProcurement;
    }).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [supplementaryParts, searchQuery, filterVehicle, filterInsurance, filterProcurement]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const handleOpenAddModal = () => {
    if (!canWrite) {
      alert("You don't have write permissions authorized.");
      return;
    }
    const activeVehs = vehicles.filter(v => !v.isDeleted && v.status !== 'Delivered');
    setSelectedVehicleReg(activeVehs.length > 0 ? activeVehs[0].regNo : '');
    setFormRows([
      { partNo: '', partName: '', qty: 1, rate: 0, insuranceStatus: 'Pending', status: 'In Order', remarks: '' }
    ]);
    setModalMode('create');
    setEditingPartId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: PartOrder) => {
    if (!canWrite) {
      alert("You don't have write permissions authorized.");
      return;
    }
    setSelectedVehicleReg(p.regNo);
    setFormRows([
      {
        partNo: p.partNo || '',
        partName: p.partName,
        qty: p.qty,
        rate: p.rate || 0,
        insuranceStatus: (p.insuranceStatus as any) || 'Pending',
        status: p.status,
        remarks: p.remarks || ''
      }
    ]);
    setModalMode('edit');
    setEditingPartId(p.id);
    setIsModalOpen(true);
  };

  const handleAddRow = () => {
    setFormRows(prev => [
      ...prev,
      { partNo: '', partName: '', qty: 1, rate: 0, insuranceStatus: 'Pending', status: 'In Order', remarks: '' }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (formRows.length <= 1) {
      alert("At least one parts row must be defined in the entry form.");
      return;
    }
    setFormRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof SupplementaryFormRow, value: any) => {
    setFormRows(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value
      };
      return next;
    });
  };

  const selectCatalogItem = (index: number, m: PartsMasterItem) => {
    setFormRows(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        partNo: m.partNo,
        partName: m.partName,
        rate: m.price
      };
      return next;
    });
    setActiveSearchIndex(null);
    setCatalogSearchText('');
  };

  const filteredMasterCatalog = useMemo(() => {
    if (!catalogSearchText) return [];
    const q = catalogSearchText.toLowerCase();
    return partsMaster.filter(p => 
      p.partNo.toLowerCase().includes(q) || 
      p.partName.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [partsMaster, catalogSearchText]);

  const handleSave = () => {
    if (!selectedVehicleReg) {
      alert("Please choose a vehicle registration first.");
      return;
    }

    // Validation
    for (let i = 0; i < formRows.length; i++) {
      const r = formRows[i];
      if (!r.partName.trim()) {
        alert(`Part Description at index ${i + 1} cannot be empty!`);
        return;
      }
      if (r.qty <= 0) {
        alert(`Quantity at index ${i + 1} must be positive.`);
        return;
      }
    }

    if (modalMode === 'create') {
      // Save all multi-rows
      formRows.forEach(r => {
        const p: PartOrder = {
          id: 'supp_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6),
          regNo: selectedVehicleReg,
          partNo: r.partNo.trim().toUpperCase(),
          partName: r.partName.trim(),
          orderNo: 'SUPP-' + Date.now().toString().slice(-6),
          orderDate: new Date().toISOString().slice(0, 10),
          qty: r.qty,
          status: r.status,
          eta: '',
          isSupplementary: true,
          rate: r.rate,
          insuranceStatus: r.insuranceStatus,
          remarks: r.remarks,
          updatedAt: Date.now()
        };
        onSavePart(p);
      });
    } else {
      // Edit mode (single item edit)
      const r = formRows[0];
      if (editingPartId) {
        const original = parts.find(x => x.id === editingPartId);
        const p: PartOrder = {
          ...original,
          id: editingPartId,
          regNo: selectedVehicleReg,
          partNo: r.partNo.trim().toUpperCase(),
          partName: r.partName.trim(),
          qty: r.qty,
          status: r.status,
          isSupplementary: true,
          rate: r.rate,
          insuranceStatus: r.insuranceStatus,
          remarks: r.remarks,
          updatedAt: Date.now()
        } as PartOrder;
        onSavePart(p);
      }
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!canDelete) {
      alert("You don't have delete credentials authorized.");
      return;
    }
    if (confirm("Are you sure you want to delete this supplementary part item?")) {
      onDeletePart(id);
    }
  };

  const exportSupplementarySpreadsheet = () => {
    const cols = [
      'S.No',
      'Vehicle Reg No',
      'Part Number',
      'Spare Part Particle',
      'Quantity Requested',
      'Unit MRP Rate (₹)',
      'Total Net Value (₹)',
      'Date Initiated',
      'Insurance Approval Status',
      'Procurement State',
      'Reference ID',
      'Custom Remarks'
    ];

    const rows = filteredList.map((p, idx) => [
      idx + 1,
      p.regNo || '—',
      p.partNo || '—',
      p.partName || '',
      p.qty || 0,
      p.rate || 0,
      p.qty * (p.rate || 0),
      p.orderDate || '',
      p.insuranceStatus || 'Pending',
      p.status || '',
      p.id || '',
      p.remarks || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplementary Inventory Logs');
    XLSX.writeFile(wb, `Supplementary_Spare_Parts_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const activeNonDeliveredVehicles = useMemo(() => {
    return vehicles.filter(v => !v.isDeleted && v.status !== 'Delivered');
  }, [vehicles]);

  return (
    <div className="space-y-6">
      
      {/* 1. STATISTICS DASH BOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Items count */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-fuchsia-500/20">
          <div className="bg-fuchsia-500/10 text-fuchsia-400 p-2.5 rounded-lg flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Total Supplementary Demands</div>
            <div className="text-2xl font-black text-slate-100 mt-1">{stats.totalItems}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Pending: {stats.pendingCount} | Approved: {stats.approvedCount}</div>
          </div>
        </div>

        {/* Approved Cost */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-emerald-500/20">
          <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-lg flex-shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Approved Spares Total Cost</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">₹{stats.approvedCost.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Insurance certified spares budget</div>
          </div>
        </div>

        {/* Pending Approval Cost */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-amber-500/20">
          <div className="bg-[#ffaa00]/10 text-amber-500 p-2.5 rounded-lg flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Pending Approv Value</div>
            <div className="text-2xl font-black text-amber-500 mt-1">₹{stats.pendingCost.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Awaiting surveyor clearance: {stats.pendingCount} items</div>
          </div>
        </div>

        {/* Cumulative Budget */}
        <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 flex items-start gap-3.5 transition-all hover:border-indigo-500/20">
          <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-widest">Cumulative Sum Value</div>
            <div className="text-2xl font-black text-indigo-400 mt-1">₹{stats.totalCost.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500 font-sans mt-1">Approved + Pending supplementary</div>
          </div>
        </div>

      </div>

      {/* 2. CONTROL FILTERS BAR */}
      <div className="bg-[#12182d] border border-[#1d2c4e] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3.5 items-center justify-between">
          
          {/* Left search */}
          <div className="relative w-full lg:max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by Vehicle Reg, Part No, Description..."
              className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 outline-none focus:border-fuchsia-500 transition-all font-sans"
            />
          </div>

          {/* Right filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Filter Vehicle */}
            <div className="flex-1 min-w-[125px]">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Filter by vehicle</label>
              <select
                value={filterVehicle}
                onChange={(e) => { setFilterVehicle(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg text-slate-300 py-1.5 px-3 text-xs outline-none focus:border-fuchsia-500 cursor-pointer font-sans"
              >
                <option value="All">All Vehicles (सारे)</option>
                {uniqueVehiclesWithSupp.map(veh => (
                  <option key={veh} value={veh}>{veh}</option>
                ))}
              </select>
            </div>

            {/* Filter Insurance Status */}
            <div className="flex-1 min-w-[125px]">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Insurance Approval</label>
              <select
                value={filterInsurance}
                onChange={(e) => { setFilterInsurance(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg text-slate-300 py-1.5 px-3 text-xs outline-none focus:border-fuchsia-500 cursor-pointer font-sans"
              >
                <option value="All">All Approvals</option>
                <option value="Approved">Approved (पास)</option>
                <option value="Pending">Pending (अटकी)</option>
                <option value="Rejected">Rejected (रद्द है)</option>
              </select>
            </div>

            {/* Filter Procurement */}
            <div className="flex-1 min-w-[125px]">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Procurement Supply</label>
              <select
                value={filterProcurement}
                onChange={(e) => { setFilterProcurement(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0a0d1a] border border-[#1d2f5a] rounded-lg text-slate-300 py-1.5 px-3 text-xs outline-none focus:border-fuchsia-500 cursor-pointer font-sans"
              >
                <option value="All">All Orders</option>
                <option value="In Order">In Order (मांग की गई)</option>
                <option value="In Transit">In Transit (रास्ते में)</option>
                <option value="Received">Received (प्राप्त)</option>
              </select>
            </div>

            {/* Reset Filters */}
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterVehicle('All');
                setFilterInsurance('All');
                setFilterProcurement('All');
                setCurrentPage(1);
              }}
              className="mt-4 bg-[#19233f] text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs transition-all font-sans hover:bg-slate-700 font-bold border border-slate-700/60"
            >
              Reset
            </button>
          </div>

        </div>
      </div>

      {/* 3. PARTS LIST LEDGER */}
      <div className="bg-[#11162d] border border-[#1b2647] rounded-xl overflow-hidden">
        <div className="p-4 bg-[#151c35] border-b border-[#1d2c4e] flex items-center justify-between flex-wrap gap-2">
          <span className="text-slate-300 text-xs font-bold font-sans uppercase">
            Supplementary Catalog Logbooks ({filteredList.length} items matched)
          </span>
          <button
            onClick={exportSupplementarySpreadsheet}
            className="bg-transparent text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-sans font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export ledger (.xlsx)
          </button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {filteredList.length === 0 ? (
            <div className="text-center py-24">
              <Layers className="w-10 h-10 text-slate-600 mx-auto stroke-1" />
              <p className="text-slate-400 text-xs font-sans mt-3">No matching supplementary parts items found in inventory systems.</p>
              {canWrite && (
                <button
                  onClick={handleOpenAddModal}
                  className="mt-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold shadow-lg text-xs px-4 py-2 rounded-lg font-sans transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Log supplementary demand
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-[#0b1021] text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-[#1c2a4f]">
                  <th className="py-3 px-4 text-center w-12">S.No</th>
                  <th className="py-3 px-4">Vehicle No</th>
                  <th className="py-3 px-4">Part Details</th>
                  <th className="py-3 px-4 text-center w-16">Qty</th>
                  <th className="py-3 px-4 text-right w-24">MRP Unit</th>
                  <th className="py-3 px-4 text-right w-28">Net Amount</th>
                  <th className="py-3 px-4 text-center w-32">Insurance Status</th>
                  <th className="py-3 px-4 text-center w-32">Procurement State</th>
                  <th className="py-3 px-4 w-40">Remarks / Order No</th>
                  {canWrite && <th className="py-3 px-4 text-center w-24">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]/45 text-slate-300 text-xs">
                {paginatedList.map((item, index) => {
                  const sNo = (currentPage - 1) * itemsPerPage + index + 1;
                  const itemAmount = item.qty * (item.rate || 0);
                  
                  return (
                    <tr key={item.id} className="hover:bg-fuchsia-500/[0.015] transition-all">
                      {/* S.No */}
                      <td className="py-3 px-4 text-center text-slate-500 font-mono text-[10px]">{sNo}</td>
                      
                      {/* Vehicle Reg */}
                      <td className="py-3 px-4 font-bold text-slate-100 uppercase tracking-wider">
                        <span className="bg-[#060811] border border-[#1b2b51] py-1 px-2 rounded-md font-mono text-[11px] inline-block tracking-wide">
                          🚗 {item.regNo}
                        </span>
                      </td>

                      {/* Part details */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{item.partName}</div>
                        {item.partNo ? (
                          <div className="text-[10px] text-blue-400 font-mono mt-0.5 tracking-wider uppercase font-bold">PN: {item.partNo}</div>
                        ) : (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">— Code</div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        {item.qty}
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        ₹{(item.rate || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-bold text-fuchsia-400 font-mono">
                        ₹{itemAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Insurance approval */}
                      <td className="py-3 px-4 text-center">
                        {item.insuranceStatus === 'Approved' ? (
                          <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase">
                            ✔️ Approved (पास)
                          </span>
                        ) : item.insuranceStatus === 'Rejected' ? (
                          <span className="inline-block bg-rose-500/10 text-rose-400 border border-rose-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase">
                            ❌ Rejected (रद्द)
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-500/10 text-amber-500 border border-amber-500/20 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase tracking-wide">
                            ⏳ Pending (लंबित)
                          </span>
                        )}
                      </td>

                      {/* Procurement supply status */}
                      <td className="py-3 px-4 text-center">
                        {item.status === 'Received' ? (
                          <span className="inline-block bg-green-600/15 text-green-400 border border-green-650/40 py-0.5 px-2 rounded text-[10px] font-extrabold uppercase">
                            ✓ Received
                          </span>
                        ) : item.status === 'In Transit' ? (
                          <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/25 py-0.5 px-2 rounded text-[10px] font-semibold uppercase flex items-center justify-center gap-1 animate-pulse">
                            <Truck className="w-3 h-3" /> In Transit
                          </span>
                        ) : (
                          <span className="inline-block bg-[#1f2845] text-slate-300 border border-[#2d3a66] py-0.5 px-2 rounded text-[10px] font-medium uppercase">
                            🛒 In Order
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        <div className="font-mono text-[10px] font-semibold text-slate-500">{item.orderNo || '—'}</div>
                        {item.remarks ? (
                          <p className="mt-0.5 italic text-[11px]" title={item.remarks}>{item.remarks}</p>
                        ) : (
                          <span className="text-slate-600 italic mt-0.5 text-[10px]">No additional comments</span>
                        )}
                      </td>

                      {/* Actions */}
                      {canWrite && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="bg-[#19233f] text-blue-400 hover:text-white hover:bg-blue-600 p-1 rounded transition-all cursor-pointer"
                              title="Edit Row"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-[#19233f] text-rose-500 hover:text-white hover:bg-rose-600 p-1 rounded transition-all cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4. PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="bg-[#131932] border-t border-[#203159] p-4 flex items-center justify-between font-sans">
            <span className="text-slate-400 text-xs">
              Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredList.length)} of {filteredList.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-[#0a0d1a] border border-[#213054] text-slate-300 p-1 px-2 rounded disabled:opacity-40 select-none cursor-pointer text-xs"
              >
                Previous
              </button>
              <span className="text-slate-200 text-xs font-bold font-mono">{currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-[#0a0d1a] border border-[#213054] text-slate-300 p-1 px-2 rounded disabled:opacity-40 select-none cursor-pointer text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. ADD & EDIT DIALOG MODAL (SUPPORTING ADD MORE MULTI-ROW ADDITION) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-md">
          <div className="bg-[#0f1424] border border-[#20325a] shadow-[0_25px_60px_rgba(0,0,0,0.9)] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1f2f54] py-4 px-6 bg-[#151c35]">
              <div>
                <h3 className="text-sm font-bold font-sans tracking-wide text-white uppercase flex items-center gap-2">
                  <span>🛠️ {modalMode === 'create' ? 'Add Supplementary Parts' : 'Edit Supplementary Part'}</span>
                </h3>
                <p className="text-[#a4b5d6] text-[10px] mt-0.5">
                  {modalMode === 'create' 
                    ? 'Log multiple post-estimation spare demands in a single layout workflow.' 
                    : 'Modify the configured supplementary item details.'}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveSearchIndex(null);
                }} 
                className="text-slate-400 hover:text-white p-1 hover:bg-rose-600 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Target Vehicle Section */}
              <div className="bg-[#12182d] border border-[#1d2a4f] rounded-xl p-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Choose Target Registered Vehicle * (सप्लीमेंट्री वाहन चुनें)
                </label>
                {modalMode === 'edit' ? (
                  <div className="bg-[#070913] border border-[#1b2b51] py-2 px-3 text-sm text-fuchsia-400 font-bold font-mono rounded inline-block uppercase">
                    🚗 {selectedVehicleReg}
                  </div>
                ) : (
                  <select
                    value={selectedVehicleReg}
                    onChange={(e) => setSelectedVehicleReg(e.target.value)}
                    className="w-full sm:max-w-md bg-[#070913] border border-[#1b2b51] text-slate-200 py-2 px-3 rounded text-xs select-none focus:outline-none focus:border-fuchsia-500 font-sans cursor-pointer"
                  >
                    <option value="" disabled>-- Select Active Vehicle --</option>
                    {activeNonDeliveredVehicles.map((v) => (
                      <option key={v.id} value={v.regNo}>
                        {v.regNo} ({v.customer} - JC: {v.jc})
                      </option>
                    ))}
                  </select>
                )}
                {activeNonDeliveredVehicles.length === 0 && modalMode === 'create' && (
                  <p className="text-[10px] text-rose-450 font-bold mt-1.5 font-sans">
                    🚨 Warning: No active workshop vehicles listed! Please register the vehicle first in Active Vehicles.
                  </p>
                )}
              </div>

              {/* Multi-Item Lines Form List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#213054]">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                    🔧 Spare parts request lines
                  </h4>
                  {modalMode === 'create' && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="bg-fuchsia-600/10 border border-fuchsia-600/30 text-fuchsia-400 hover:bg-fuchsia-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer select-none"
                    >
                      <Plus className="w-3.5 h-3.5" /> add another spare item (और जोड़ें)
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {formRows.map((row, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#0a0d1a] border border-[#182342] rounded-xl p-4 space-y-4 relative hover:border-fuchsia-500/25 transition-all"
                    >
                      {/* Close row option for multi-row */}
                      {modalMode === 'create' && formRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="absolute top-2.5 right-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-md transition-all cursor-pointer"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Row Badge */}
                      <div className="inline-block bg-[#161c32] text-[10px] font-bold text-slate-400 font-mono py-0.5 px-2 rounded-md">
                        Part Item #{idx + 1}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        
                        {/* Part Number (Search Catalog trigger) */}
                        <div className="md:col-span-3 relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Part Number (Optional)</label>
                          <input
                            type="text"
                            value={row.partNo}
                            onChange={(e) => {
                              handleRowChange(idx, 'partNo', e.target.value);
                              setActiveSearchIndex(idx);
                              setCatalogSearchText(e.target.value);
                            }}
                            placeholder="Type or Search Code..."
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs focus:outline-none focus:border-fuchsia-500 font-mono tracking-wider"
                          />
                          
                          {/* Auto-suggest dropdown from partsMaster catalog */}
                          {activeSearchIndex === idx && catalogSearchText && filteredMasterCatalog.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-[#0a1024] border border-[#223565] rounded-lg shadow-2xl z-20 overflow-hidden font-sans text-xs">
                              <div className="bg-[#141b34] px-3 py-1.5 border-b border-[#223565] text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                                Suggestions in master catalog
                              </div>
                              <ul className="divide-y divide-[#223565]/60">
                                {filteredMasterCatalog.map(m => (
                                  <li key={m.id}>
                                    <button
                                      type="button"
                                      onClick={() => selectCatalogItem(idx, m)}
                                      className="w-full text-left py-2 px-3 text-slate-200 hover:bg-rose-600 hover:text-white transition-all block font-bold"
                                    >
                                      <div className="font-mono text-xs">{m.partNo}</div>
                                      <div className="text-[10px] opacity-80 font-normal truncate">{m.partName} - ₹{m.price}</div>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Part Name Description */}
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Part Name / Particular *</label>
                          <input
                            type="text"
                            value={row.partName}
                            onChange={(e) => handleRowChange(idx, 'partName', e.target.value)}
                            placeholder="e.g. Front Bumper, Tail Light Assy..."
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs focus:outline-none focus:border-fuchsia-500 font-sans"
                            required
                          />
                        </div>

                        {/* Qty */}
                        <div className="md:col-span-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={row.qty}
                            onChange={(e) => handleRowChange(idx, 'qty', parseInt(e.target.value) || 1)}
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs text-center font-bold focus:outline-none focus:border-fuchsia-500 font-mono"
                          />
                        </div>

                        {/* Rate */}
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Rate (₹)</label>
                          <input
                            type="number"
                            min={0}
                            value={row.rate}
                            onChange={(e) => handleRowChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-2 px-3 rounded text-xs text-right font-bold focus:outline-none focus:border-fuchsia-500 font-mono"
                          />
                        </div>

                        {/* Net Amount Preview */}
                        <div className="md:col-span-1.5 text-right px-2 pb-2">
                          <div className="text-[9px] uppercase font-bold text-slate-400 font-sans">Row Net</div>
                          <strong className="text-fuchsia-400 text-xs font-mono">
                            ₹{(row.qty * row.rate).toLocaleString('en-IN')}
                          </strong>
                        </div>

                      </div>

                      {/* Line Item Status Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#1d2a4f]/50 pt-3 mt-1 text-left">
                        
                        {/* Insurance Approval Status */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Insurance Approval Status</label>
                          <div className="flex gap-2">
                            {['Pending', 'Approved', 'Rejected'].map((statusOption) => (
                              <button
                                key={statusOption}
                                type="button"
                                onClick={() => handleRowChange(idx, 'insuranceStatus', statusOption)}
                                className={`flex-1 py-1 px-2 text-[10px] font-black rounded-md tracking-wider border select-none transition-all cursor-pointer text-center ${
                                  row.insuranceStatus === statusOption
                                    ? statusOption === 'Approved'
                                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow'
                                      : statusOption === 'Rejected'
                                        ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow'
                                        : 'bg-amber-500/15 border-amber-500 text-amber-500 shadow'
                                    : 'bg-[#121626] border-[#202e53]/55 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {statusOption}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Procurement Supply State */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Procurement Supply status</label>
                          <select
                            value={row.status}
                            onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                            className="bg-[#070913] border border-[#1b2b51] text-slate-350 py-1.5 px-3 rounded text-[11px] outline-none focus:border-fuchsia-500 cursor-pointer font-sans w-full"
                          >
                            <option value="In Order">In Order (मांग दर्ज है)</option>
                            <option value="In Transit">In Transit (रास्ते में है)</option>
                            <option value="Received">Received (स्टॉक प्राप्त)</option>
                          </select>
                        </div>

                        {/* Remarks */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Additional Remarks (टिप्पणी)</label>
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                            placeholder="e.g. Surveyor asked for photo..."
                            className="w-full bg-[#070913] border border-[#1b2b51] text-slate-100 py-1.5 px-3 rounded text-[11px] focus:outline-none focus:border-fuchsia-500 font-sans"
                          />
                        </div>

                      </div>

                    </div>
                  ))}
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-[#131932] border-t border-[#1f2f54] py-3.5 px-6 flex justify-between items-center">
              <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
                Total Parts Requested: <strong className="text-white">{formRows.length} rows</strong> | Cumulative: <strong className="text-fuchsia-400">₹{formRows.reduce((s, r)=> s + (r.qty * r.rate), 0).toLocaleString('en-IN')}</strong>
              </span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-5 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2 px-6 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans shadow-lg shadow-fuchsia-600/20"
                >
                  Save Entry
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
