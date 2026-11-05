import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { SalesHeader } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import { InvoiceRenderer } from '../../components/invoice/InvoiceRenderer.tsx';
import { 
  formatINR, 
  formatWeight, 
  calcGstBreakdown, 
  roundTo2, 
  roundTo3 
} from '../../utils/calculations.ts';
import { 
  Send, 
  Plus, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Scale, 
  Truck, 
  Boxes,
  Edit2,
  Trash2,
  Eye
} from 'lucide-react';

import { ScrapCategory } from '../../types/index.ts';

export const SalesView: React.FC = () => {
  const { 
    sales, 
    parties, 
    materials, 
    yards, 
    inventoryLots, 
    stockMovements, 
    createSalesOrder, 
    updateSalesOrder,
    deleteSalesOrder,
    dispatchSalesOrder, 
    invoices,
    company, 
    addMaterial,
    currentUser 
  } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);

  // Edit Sales Order Modal State
  const [editingOrder, setEditingOrder] = useState<SalesHeader | null>(null);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editYardId, setEditYardId] = useState('');
  const [editVehicleReg, setEditVehicleReg] = useState('');
  const [editMaterialId, setEditMaterialId] = useState('');
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editRatePerUnit, setEditRatePerUnit] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');

  // Quick Add Material Modal
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<ScrapCategory>('Steel');
  const [newMatHsn, setNewMatHsn] = useState('7204');
  const [newMatBuyRate, setNewMatBuyRate] = useState<number>(28);
  const [newMatSellRate, setNewMatSellRate] = useState<number>(31.5);

  // Form State
  const customers = parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [yardId, setYardId] = useState(yards[0]?.id || '');
  const [vehicleReg, setVehicleReg] = useState('TN 18 BY 0420');

  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(7720); // matching TEJAS template sample
  const [ratePerUnit, setRatePerUnit] = useState<number>(materials[0]?.defaultSalesRate || 31.5);

  const handleQuickAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) return;
    const nextSeq = materials.length + 1;
    const created = addMaterial({
      code: `MAT-SCRAP-${String(nextSeq).padStart(3, '0')}`,
      name: newMatName.trim(),
      category: newMatCategory,
      baseUnit: 'KG',
      hsnCode: newMatHsn.trim() || '7204',
      defaultPurchaseRate: Number(newMatBuyRate),
      defaultSalesRate: Number(newMatSellRate),
      defaultGstRate: 18,
      minStockAlert: 500,
      isActive: true,
    });
    setMaterialId(created.id);
    setRatePerUnit(created.defaultSalesRate);
    setIsAddMaterialModalOpen(false);
    setNewMatName('');
  };

  // Available stock calculation
  const availableStock = roundTo3(
    stockMovements
      .filter((m) => m.materialId === materialId && m.yardId === yardId)
      .reduce((sum, m) => sum + m.quantity, 0)
  );

  const isStockSufficient = availableStock >= quantity;

  // Pricing calculations
  const taxableAmount = roundTo2(quantity * ratePerUnit);
  const gstBreakdown = calcGstBreakdown(taxableAmount, 18, false);

  const handleCreateAndDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStockSufficient) return;

    const newOrder = createSalesOrder({
      orderDate: new Date().toISOString(),
      customerPartyId: customerId,
      yardId,
      vehicleRegistration: vehicleReg,
      lines: [
        {
          id: 'sol-' + Math.random().toString(36).substring(2, 9),
          materialId,
          quantity,
          ratePerUnit,
          gstRate: 18,
          taxableAmount,
          gstAmount: gstBreakdown.totalTax,
          totalAmount: gstBreakdown.grandTotal,
          lotAllocations: [],
        },
      ],
      status: 'CONFIRMED',
      subtotalAmount: taxableAmount,
      taxAmount: gstBreakdown.totalTax,
      totalAmount: gstBreakdown.grandTotal,
      allocatedCogs: 0,
      createdBy: currentUser.fullName,
    });

    // Directly dispatch order and generate invoice
    const generatedInvoice = dispatchSalesOrder(newOrder.id);
    setIsModalOpen(false);
    setActiveInvoice(generatedInvoice);
  };

  const handleOpenEdit = (order: SalesHeader) => {
    setEditingOrder(order);
    setEditCustomerId(order.customerPartyId);
    setEditYardId(order.yardId);
    setEditVehicleReg(order.vehicleRegistration || '');
    const firstLine = order.lines[0];
    if (firstLine) {
      setEditMaterialId(firstLine.materialId);
      setEditQuantity(firstLine.quantity);
      setEditRatePerUnit(firstLine.ratePerUnit);
    } else {
      setEditMaterialId(materials[0]?.id || '');
      setEditQuantity(100);
      setEditRatePerUnit(materials[0]?.defaultSalesRate || 30);
    }
    setEditNotes(order.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const taxable = roundTo2(editQuantity * editRatePerUnit);
    const gst = calcGstBreakdown(taxable, 18, false);
    updateSalesOrder(editingOrder.id, {
      customerPartyId: editCustomerId,
      yardId: editYardId,
      vehicleRegistration: editVehicleReg,
      notes: editNotes,
      lines: [
        {
          id: editingOrder.lines[0]?.id || ('sol-' + Math.random().toString(36).substring(2, 9)),
          materialId: editMaterialId,
          quantity: editQuantity,
          ratePerUnit: editRatePerUnit,
          gstRate: 18,
          taxableAmount: taxable,
          gstAmount: gst.totalTax,
          totalAmount: gst.grandTotal,
          lotAllocations: [],
        },
      ],
      subtotalAmount: taxable,
      taxAmount: gst.totalTax,
      totalAmount: gst.grandTotal,
    });
    setEditingOrder(null);
  };

  const handleDeleteOrder = (order: SalesHeader) => {
    if (window.confirm(`Are you sure you want to delete Sales Order "${order.salesNo}"?`)) {
      const res = deleteSalesOrder(order.id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Sales & Material Dispatch</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create sales dispatches, enforce available stock limits, allocate FIFO lots, and generate Tax Invoices.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Order & Dispatch</span>
        </button>
      </div>

      {/* Sales Orders List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Sales Ref #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Vehicle Reg</th>
                <th className="py-3 px-4 text-right">Dispatched Qty</th>
                <th className="py-3 px-4 text-right">Taxable Value</th>
                <th className="py-3 px-4 text-right">Grand Total (GST)</th>
                <th className="py-3 px-4 text-right">Allocated COGS</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                    No sales dispatches created yet. Click "+ New Sales Order & Dispatch" to sell scrap.
                  </td>
                </tr>
              ) : (
                sales.map((order) => {
                  const customer = parties.find((p) => p.id === order.customerPartyId);
                  const totalQty = order.lines.reduce((s, l) => s + l.quantity, 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{order.salesNo}</td>
                      <td className="py-3 px-4 text-slate-600">{order.orderDate.split('T')[0]}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{customer?.legalName}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{order.vehicleRegistration || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatWeight(totalQty)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">{formatINR(order.subtotalAmount)}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-red-600">{formatINR(order.totalAmount)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{formatINR(order.allocatedCogs)}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.status === 'CONFIRMED' && (
                            <>
                              <button
                                onClick={() => {
                                  const inv = dispatchSalesOrder(order.id);
                                  setActiveInvoice(inv);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm"
                              >
                                Dispatch Now
                              </button>
                              <button
                                onClick={() => handleOpenEdit(order)}
                                className="p-1 hover:bg-amber-50 text-amber-600 rounded transition-colors"
                                title="Edit Sales Order"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(order)}
                                className="p-1 hover:bg-rose-50 text-rose-600 rounded transition-colors"
                                title="Delete Sales Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {order.status === 'DISPATCHED' && (
                            <>
                              <span className="text-[10px] font-semibold text-emerald-700 mr-1">Invoiced ✓</span>
                              {(() => {
                                const inv = invoices.find((i) => i.id === order.invoiceId || i.salesHeaderId === order.id);
                                return inv ? (
                                  <button
                                    onClick={() => setActiveInvoice(inv)}
                                    className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition-colors"
                                    title="View Invoice"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                ) : null;
                              })()}
                              <button
                                disabled
                                className="p-1 text-slate-300 cursor-not-allowed rounded"
                                title="Dispatched orders cannot be deleted because stock lots were consumed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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

      {/* New Sales Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Scrap Sales & Dispatch Order"
        subtitle="Validate stock balance, allocate FIFO inventory lots, and generate approved Tax Invoice."
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateAndDispatch} className="space-y-4 text-xs">
          {!isStockSufficient && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Negative stock prevention: Requested quantity ({quantity} KG) exceeds available stock ({availableStock} KG).
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Customer / Buyer *</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName} ({c.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Dispatch Yard</label>
              <select
                value={yardId}
                onChange={(e) => setYardId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                {yards.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Outbound Motor Vehicle #</label>
              <input
                type="text"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono uppercase"
                placeholder="e.g. TN 18 BY 0420"
                required
              />
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-red-600" />
                <span>Material Order & Stock Allocation</span>
              </h4>
              <span className={`text-[11px] font-bold ${isStockSufficient ? 'text-emerald-700' : 'text-rose-600'}`}>
                Available in Yard: {formatWeight(availableStock)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-600">Material Scrap *</label>
                  <button
                    type="button"
                    onClick={() => setIsAddMaterialModalOpen(true)}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ New Material</span>
                  </button>
                </div>
                <select
                  value={materialId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    setMaterialId(mId);
                    const mat = materials.find((m) => m.id === mId);
                    if (mat) setRatePerUnit(mat.defaultSalesRate);
                  }}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg font-medium"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Dispatched Weight (KG) *</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  step="0.5"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Selling Rate (₹/KG) *</label>
                <input
                  type="number"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  step="0.25"
                  min="0.1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-900 text-white rounded-lg text-[11px] font-mono">
              <div>
                <span className="text-slate-400 block uppercase">Taxable Subtotal</span>
                <span className="font-bold text-slate-100 text-xs">{formatINR(taxableAmount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase">CGST (9%)</span>
                <span className="font-bold text-slate-100 text-xs">{formatINR(gstBreakdown.cgstAmount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase">SGST (9%)</span>
                <span className="font-bold text-slate-100 text-xs">{formatINR(gstBreakdown.sgstAmount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase">Invoice Grand Total</span>
                <span className="font-black text-red-400 text-sm">{formatINR(gstBreakdown.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isStockSufficient}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm transition-all"
            >
              Confirm Dispatch & Generate Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Generated Invoice Preview Modal */}
      {activeInvoice && (
        <Modal
          isOpen={!!activeInvoice}
          onClose={() => setActiveInvoice(null)}
          title={`Issued Tax Invoice — ${activeInvoice.invoiceNo}`}
          subtitle="A4 Document Preview with Yashoth Enterprises Letterhead"
          maxWidth="6xl"
        >
          <InvoiceRenderer
            invoice={activeInvoice}
            company={company}
            onClose={() => setActiveInvoice(null)}
          />
        </Modal>
      )}

      {/* Quick Add Material Sub-Modal */}
      <Modal
        isOpen={isAddMaterialModalOpen}
        onClose={() => setIsAddMaterialModalOpen(false)}
        title="Quick Add Scrap Material"
        subtitle="Register new scrap type and automatically select it for this dispatch order."
        maxWidth="lg"
      >
        <form onSubmit={handleQuickAddMaterial} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Scrap Material Name *</label>
            <input
              type="text"
              value={newMatName}
              onChange={(e) => setNewMatName(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              placeholder="e.g. Copper Wire Armature Scrap"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category *</label>
              <select
                value={newMatCategory}
                onChange={(e) => setNewMatCategory(e.target.value as ScrapCategory)}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                {['Steel', 'Iron', 'Aluminium', 'Copper', 'Brass', 'Plastic', 'Other'].map((cat) => (
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
                value={newMatHsn}
                onChange={(e) => setNewMatHsn(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                placeholder="7204"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Buy Rate (₹/KG) *</label>
              <input
                type="number"
                value={newMatBuyRate}
                onChange={(e) => setNewMatBuyRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.25"
                min="0"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Sell Rate (₹/KG) *</label>
              <input
                type="number"
                value={newMatSellRate}
                onChange={(e) => setNewMatSellRate(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                step="0.25"
                min="0"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddMaterialModalOpen(false)}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm"
            >
              Save & Select Material
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Sales Order Modal */}
      {editingOrder && (
        <Modal
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          title={`Edit Sales Order — ${editingOrder.salesNo}`}
          subtitle="Update customer, yard, vehicle registration, and scrap line items."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer / Buyer *</label>
                <select
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.legalName} ({c.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dispatch Yard</label>
                <select
                  value={editYardId}
                  onChange={(e) => setEditYardId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                >
                  {yards.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Vehicle Registration #</label>
                <input
                  type="text"
                  value={editVehicleReg}
                  onChange={(e) => setEditVehicleReg(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono uppercase"
                  placeholder="e.g. TN 18 BY 0420"
                />
              </div>
            </div>

            <div className="p-3 border border-slate-200 rounded-lg space-y-3">
              <h4 className="font-bold text-slate-800">Scrap Material & Pricing</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Material Scrap *</label>
                  <select
                    value={editMaterialId}
                    onChange={(e) => {
                      const mId = e.target.value;
                      setEditMaterialId(mId);
                      const mat = materials.find((m) => m.id === mId);
                      if (mat) setEditRatePerUnit(mat.defaultSalesRate);
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Quantity (KG) *</label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                    step="0.5"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Rate (₹/KG) *</label>
                  <input
                    type="number"
                    value={editRatePerUnit}
                    onChange={(e) => setEditRatePerUnit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                    step="0.25"
                    min="0.1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Order Notes / Remarks</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  placeholder="Optional delivery or customer notes"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-900 text-white rounded text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">TAXABLE</span>
                  <span className="font-bold">{formatINR(roundTo2(editQuantity * editRatePerUnit))}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">GST (18%)</span>
                  <span className="font-bold">{formatINR(calcGstBreakdown(roundTo2(editQuantity * editRatePerUnit), 18, false).totalTax)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">GRAND TOTAL</span>
                  <span className="font-black text-red-400">{formatINR(calcGstBreakdown(roundTo2(editQuantity * editRatePerUnit), 18, false).grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
