import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Material, ScrapCategory } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { formatINR, formatWeight } from '../../utils/calculations.ts';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Layers, 
  Tag, 
  CheckCircle, 
  AlertCircle,
  Filter,
  DollarSign
} from 'lucide-react';

export const MaterialsMasterTab: React.FC = () => {
  const { materials, addMaterial, updateMaterial, deleteMaterial, stockMovements } = useERP();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ScrapCategory>('Steel');
  const [baseUnit, setBaseUnit] = useState('KG');
  const [hsnCode, setHsnCode] = useState('7204');
  const [purchaseRate, setPurchaseRate] = useState<number>(28);
  const [salesRate, setSalesRate] = useState<number>(31.5);
  const [gstRate, setGstRate] = useState<number>(18);
  const [minStockAlert, setMinStockAlert] = useState<number>(500);
  const [isActive, setIsActive] = useState<boolean>(true);

  const categories: ScrapCategory[] = ['Steel', 'Iron', 'Aluminium', 'Copper', 'Brass', 'Plastic', 'Other'];

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    const nextSeq = materials.length + 1;
    setCode(`MAT-SCRAP-${String(nextSeq).padStart(3, '0')}`);
    setName('');
    setCategory('Steel');
    setBaseUnit('KG');
    setHsnCode('7204');
    setPurchaseRate(28);
    setSalesRate(31.5);
    setGstRate(18);
    setMinStockAlert(500);
    setIsActive(true);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (mat: Material) => {
    setEditingMaterial(mat);
    setCode(mat.code);
    setName(mat.name);
    setCategory(mat.category);
    setBaseUnit(mat.baseUnit || 'KG');
    setHsnCode(mat.hsnCode || '7204');
    setPurchaseRate(mat.defaultPurchaseRate);
    setSalesRate(mat.defaultSalesRate);
    setGstRate(mat.defaultGstRate || 18);
    setMinStockAlert(mat.minStockAlert || 500);
    setIsActive(mat.isActive);
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingMaterial) {
      updateMaterial(editingMaterial.id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category,
        baseUnit,
        hsnCode: hsnCode.trim(),
        defaultPurchaseRate: Number(purchaseRate),
        defaultSalesRate: Number(salesRate),
        defaultGstRate: Number(gstRate),
        minStockAlert: Number(minStockAlert),
        isActive,
      });
      setFeedbackMsg({ type: 'success', text: `Material "${name}" updated successfully.` });
    } else {
      addMaterial({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category,
        baseUnit,
        hsnCode: hsnCode.trim(),
        defaultPurchaseRate: Number(purchaseRate),
        defaultSalesRate: Number(salesRate),
        defaultGstRate: Number(gstRate),
        minStockAlert: Number(minStockAlert),
        isActive: true,
      });
      setFeedbackMsg({ type: 'success', text: `New Material "${name}" created successfully.` });
    }

    setIsAddModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleDelete = (mat: Material) => {
    if (confirm(`Are you sure you want to delete or deactivate scrap material "${mat.name}"?`)) {
      const res = deleteMaterial(mat.id);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || `Material "${mat.name}" removed.` });
      } else {
        setFeedbackMsg({ type: 'error', text: res.message || `Failed to delete material.` });
      }
      setTimeout(() => setFeedbackMsg(null), 6000);
    }
  };

  const filteredMaterials = materials.filter((m) => {
    if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        m.name.toLowerCase().includes(term) ||
        m.code.toLowerCase().includes(term) ||
        (m.hsnCode && m.hsnCode.includes(term))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Control Bar: Search, Category Filter, and Add Button */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by scrap name, code, HSN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Scrap Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Material</span>
        </button>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Code / HSN</th>
                <th className="py-3 px-4">Scrap Material Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Default Buy Rate</th>
                <th className="py-3 px-4 text-right">Default Sell Rate</th>
                <th className="py-3 px-4 text-right">Gross Margin</th>
                <th className="py-3 px-4 text-right">Stock On Hand</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions (CRUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No materials found matching criteria. Click "+ Add New Material" to register scrap items.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((mat) => {
                  const currentStock = stockMovements
                    .filter((m) => m.materialId === mat.id)
                    .reduce((sum, m) => sum + m.quantity, 0);
                  const margin = mat.defaultSalesRate - mat.defaultPurchaseRate;
                  const marginPct = mat.defaultPurchaseRate > 0 ? (margin / mat.defaultPurchaseRate) * 100 : 0;

                  return (
                    <tr key={mat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-800 block">{mat.code}</span>
                        <span className="text-[10px] text-slate-500 font-mono">HSN: {mat.hsnCode || '7204'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block text-xs">{mat.name}</span>
                        <span className="text-[10px] text-slate-500">Unit: {mat.baseUnit} · GST: {mat.defaultGstRate || 18}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {mat.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {formatINR(mat.defaultPurchaseRate)} / {mat.baseUnit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {formatINR(mat.defaultSalesRate)} / {mat.baseUnit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`font-bold ${margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {margin >= 0 ? '+' : ''}{formatINR(margin)}
                        </span>
                        <span className="text-[10px] block text-slate-400">
                          ({marginPct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`font-black ${currentStock <= (mat.minStockAlert || 500) ? 'text-amber-700' : 'text-slate-800'}`}>
                          {formatWeight(currentStock)}
                        </span>
                        {currentStock <= (mat.minStockAlert || 500) && (
                          <span className="text-[9px] text-amber-600 block font-sans">Low Stock</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={mat.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(mat)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Edit Material"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(mat)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Delete or Deactivate Material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Material Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingMaterial ? `Edit Material: ${editingMaterial.name}` : 'Register New Scrap Material'}
        subtitle="Define scrap commodity specifications, HSN tax classifications, and default pricing benchmarks."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Material Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono uppercase"
                placeholder="e.g. MAT-COP-01"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Scrap Material Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
                placeholder="e.g. Copper Wire Armature Scrap"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Scrap Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ScrapCategory)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">HSN Code *</label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="7204"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Base Measurement Unit</label>
              <select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="KG">Kilograms (KG)</option>
                <option value="MT">Metric Tonnes (MT)</option>
                <option value="PCS">Pieces (PCS)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">GST Rate (%)</label>
              <input
                type="number"
                value={gstRate}
                onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.5"
                min="0"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Purchase Rate (₹/{baseUnit}) *</label>
              <input
                type="number"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.25"
                min="0"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Sales Rate (₹/{baseUnit}) *</label>
              <input
                type="number"
                value={salesRate}
                onChange={(e) => setSalesRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.25"
                min="0"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Low Stock Alert Threshold ({baseUnit})</label>
              <input
                type="number"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                min="0"
              />
            </div>

            {editingMaterial && (
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="isActiveMat"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-red-600 w-4 h-4"
                />
                <label htmlFor="isActiveMat" className="font-semibold text-slate-800 cursor-pointer">
                  Material is Active for Transactions
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-600/20"
            >
              {editingMaterial ? 'Save Material Changes' : 'Create & Register Material'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
