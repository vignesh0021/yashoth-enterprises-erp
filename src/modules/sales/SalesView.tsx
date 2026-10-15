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
  Boxes 
} from 'lucide-react';

export const SalesView: React.FC = () => {
  const { 
    sales, 
    parties, 
    materials, 
    yards, 
    inventoryLots, 
    stockMovements, 
    createSalesOrder, 
    dispatchSalesOrder, 
    company, 
    currentUser 
  } = useERP();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);

  // Form State
  const customers = parties.filter((p) => p.partyType === 'CUSTOMER' || p.partyType === 'BOTH');
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [yardId, setYardId] = useState(yards[0]?.id || '');
  const [vehicleReg, setVehicleReg] = useState('TN 18 BY 0420');

  const [materialId, setMaterialId] = useState(materials[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(7720); // matching TEJAS template sample
  const [ratePerUnit, setRatePerUnit] = useState<number>(materials[0]?.defaultSalesRate || 31.5);

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
                        {order.status === 'CONFIRMED' && (
                          <button
                            onClick={() => {
                              const inv = dispatchSalesOrder(order.id);
                              setActiveInvoice(inv);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-sm"
                          >
                            Dispatch Now
                          </button>
                        )}
                        {order.status === 'DISPATCHED' && (
                          <span className="text-[10px] font-semibold text-emerald-700">Invoiced ✓</span>
                        )}
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
                <label className="font-semibold text-slate-600 block mb-1">Material Scrap</label>
                <select
                  value={materialId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    setMaterialId(mId);
                    const mat = materials.find((m) => m.id === mId);
                    if (mat) setRatePerUnit(mat.defaultSalesRate);
                  }}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
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
    </div>
  );
};
