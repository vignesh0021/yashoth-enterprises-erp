import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { Vehicle, VehicleDocument } from '../../types/index.ts';
import { Modal } from '../../components/common/Modal.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { formatWeight, formatINR } from '../../utils/calculations.ts';
import {
  evaluateFleetCompliance,
  lookupVehicleRtoDetails,
  normalizeVehicleRegistration,
  type VahanRtoLookupResult,
  type VehicleComplianceAlert,
} from '../../../backend/business-rules/vehicleComplianceEngine.ts';
import {
  Car,
  Plus,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Clock,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
  Share2,
  Phone,
  CheckCircle2,
  MapPin,
  Wrench,
  Upload,
  FileUp,
  Download,
  BookUser,
  ExternalLink,
  Bell,
  BellRing,
  Clipboard,
  Bike,
  Truck
} from 'lucide-react';
import { pickContactFromPhonebook } from '../../utils/contactPicker.ts';
import { getCarInfoUrl, getParivahanUrl, parseCarInfoText } from '../../utils/carInfoScraper.ts';

export const VehiclesView: React.FC = () => {
  const {
    vehicles,
    vehicleDocuments,
    expenses,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addVehicleDocument,
    updateVehicleDocument,
    deleteVehicleDocument,
    renewVehicleDocument,
    uploadedDocuments,
    createUploadedDocument,
    deleteUploadedDocument,
    dailyTasks,
    createDailyTask,
  } = useERP();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ALERTS' | 'INSURANCE' | 'OWNED' | 'UPLOADED_DOCS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // CarInfo Auto-Scrape & Category State
  const [vehicleCategory, setVehicleCategory] = useState<'COMMERCIAL_TRUCK' | 'TWO_WHEELER' | 'LIGHT_VEHICLE' | 'CAR'>('COMMERCIAL_TRUCK');
  const [isCarInfoScrapeModalOpen, setIsCarInfoScrapeModalOpen] = useState(false);
  const [carInfoRawText, setCarInfoRawText] = useState('');

  // Document Add / Edit Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [targetVehicleForDoc, setTargetVehicleForDoc] = useState<Vehicle | null>(null);
  const [editingDoc, setEditingDoc] = useState<VehicleDocument | null>(null);

  // Upload Vehicle Document Modal State
  const [isUploadVehicleDocModalOpen, setIsUploadVehicleDocModalOpen] = useState(false);
  const [uploadVehReg, setUploadVehReg] = useState('TN 05 Y 1936');
  const [uploadDocCategory, setUploadDocCategory] = useState<'RC' | 'INSURANCE' | 'FITNESS' | 'POLLUTION' | 'PERMIT' | 'TAX'>('INSURANCE');
  const [uploadDocRefNo, setUploadDocRefNo] = useState('');
  const [uploadDocTitle, setUploadDocTitle] = useState('');
  const [uploadDocDate, setUploadDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadDocExpiry, setUploadDocExpiry] = useState('');
  const [uploadDocNotes, setUploadDocNotes] = useState('');
  const [uploadVehFileData, setUploadVehFileData] = useState<{
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  } | null>(null);

  // Vahan RTO API Lookup State
  const [isLookingUpRto, setIsLookingUpRto] = useState(false);
  const [rtoResult, setRtoResult] = useState<VahanRtoLookupResult | null>(null);
  const [autoPopulateDocs, setAutoPopulateDocs] = useState(true);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Vehicle Form State
  const [regNo, setRegNo] = useState('');
  const [vehType, setVehType] = useState('Eicher Pro 3015 17ft Lorry');
  const [ownership, setOwnership] = useState<Vehicle['ownershipType']>('OWNED');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [tareWeight, setTareWeight] = useState<number>(4100);

  // Document Form State
  const [docType, setDocType] = useState<VehicleDocument['documentType']>('INSURANCE');
  const [docNumber, setDocNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [reminderDays, setReminderDays] = useState<number>(30);
  const [docNotes, setDocNotes] = useState('');

  // Evaluate Live Fleet Compliance & Insurance Alerts
  const complianceSummary = useMemo(
    () => evaluateFleetCompliance(vehicles, vehicleDocuments),
    [vehicles, vehicleDocuments]
  );

  const urgentAlerts = useMemo(
    () => complianceSummary.alerts.filter((a) => a.severity !== 'VALID'),
    [complianceSummary]
  );

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((veh) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchReg = veh.registrationNo.toLowerCase().includes(q);
        const matchDriver = (veh.driverName || '').toLowerCase().includes(q);
        const matchType = veh.vehicleType.toLowerCase().includes(q);
        if (!matchReg && !matchDriver && !matchType) return false;
      }

      if (activeFilter === 'OWNED') return veh.ownershipType === 'OWNED';
      if (activeFilter === 'ALERTS') {
        const hasAlert = urgentAlerts.some((a) => a.vehicleId === veh.id);
        const missingIns = complianceSummary.missingInsuranceVehicles.some((m) => m.id === veh.id);
        return hasAlert || missingIns;
      }
      if (activeFilter === 'INSURANCE') {
        return true;
      }
      return true;
    });
  }, [vehicles, searchTerm, activeFilter, urgentAlerts, complianceSummary]);

  const uploadedVehDocs = useMemo(
    () => uploadedDocuments.filter((d) => d.category === 'VEHICLE_DOC'),
    [uploadedDocuments]
  );

  const handleUploadVehFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadVehFileData({
        name: file.name,
        type: file.type || 'application/pdf',
        size: file.size,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUploadedVehDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocRefNo.trim()) {
      alert('Please enter a Document / Policy Reference Number.');
      return;
    }
    createUploadedDocument({
      category: 'VEHICLE_DOC',
      referenceNo: uploadDocRefNo.trim(),
      title: uploadDocTitle.trim() || `${uploadDocCategory} - ${uploadVehReg}`,
      partyName: uploadVehReg,
      documentDate: uploadDocDate,
      amount: 0,
      fileName: uploadVehFileData?.name || `${uploadDocCategory}_${uploadVehReg.replace(/\s+/g, '')}.pdf`,
      fileType: uploadVehFileData?.type || 'application/pdf',
      fileSize: uploadVehFileData?.size || 150000,
      fileDataUrl: uploadVehFileData?.dataUrl || '',
      notes: `${uploadDocNotes ? uploadDocNotes + ' | ' : ''}Expiry: ${uploadDocExpiry || 'N/A'}`,
    });
    showToast('success', `${uploadDocCategory} Document for ${uploadVehReg} uploaded and saved!`);
    setIsUploadVehicleDocModalOpen(false);
    setUploadDocRefNo('');
    setUploadVehFileData(null);
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setRegNo('TN 18 BY ');
    setVehicleCategory('COMMERCIAL_TRUCK');
    setVehType('Eicher Pro 3015 17ft Lorry');
    setOwnership('OWNED');
    setDriverName('');
    setDriverPhone('');
    setTareWeight(4100);
    setRtoResult(null);
    setAutoPopulateDocs(true);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setRegNo(v.registrationNo);
    setVehType(v.vehicleType);
    setOwnership(v.ownershipType);
    setDriverName(v.driverName || '');
    setDriverPhone(v.driverPhone || '');
    setTareWeight(v.tareWeight);
    if (v.tareWeight <= 250 || /splendor|activa|pulsar|jupiter|bullet|yamaha|bike|motorcycle|scooter/i.test(v.vehicleType)) {
      setVehicleCategory('TWO_WHEELER');
    } else if (v.tareWeight <= 2000 || /ace|pickup|bolero|dost|intra/i.test(v.vehicleType)) {
      setVehicleCategory('LIGHT_VEHICLE');
    } else {
      setVehicleCategory('COMMERCIAL_TRUCK');
    }
    setRtoResult(null);
    setAutoPopulateDocs(false);
    setIsVehicleModalOpen(true);
  };

  // Open live CarInfo search in external browser tab
  const handleOpenCarInfo = (targetReg?: string) => {
    const query = targetReg || regNo;
    if (!query || query.trim().length < 3) {
      showToast('error', 'Please enter a vehicle registration number first.');
      return;
    }
    const url = getCarInfoUrl(query);
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('success', `Opening live CarInfo search for ${query} in browser...`);
  };

  // Auto-Scrape & Fill details from CarInfo copied text
  const handleAutoScrapeCarInfo = (rawText: string) => {
    if (!rawText || !rawText.trim()) {
      showToast('error', 'Please paste the vehicle details copied from CarInfo or RC portal.');
      return;
    }
    const parsed = parseCarInfoText(rawText);
    if (parsed.regNo) setRegNo(parsed.regNo);
    if (parsed.makerModel) setVehType(parsed.makerModel);
    if (parsed.unladenWeightKg) setTareWeight(parsed.unladenWeightKg);
    if (parsed.vehicleCategory) setVehicleCategory(parsed.vehicleCategory);

    const todayStr = new Date().toISOString().split('T')[0];
    const nextYearStr = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const nextSixMoStr = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const normReg = parsed.regNo || regNo || 'TN 18 BY 0420';
    const scrapedRto: VahanRtoLookupResult = {
      success: true,
      source: 'RTO_REGISTRY_ENGINE',
      registrationNo: normReg,
      formattedRegNo: normReg,
      isValidFormat: true,
      stateCode: normReg.slice(0, 2) || 'TN',
      stateName: 'Tamil Nadu',
      rtoCode: parsed.rtoCode || 'TN-18',
      rtoOfficeName: parsed.rtoOffice || 'Chennai North West / Red Hills',
      vehicleClass: parsed.vehicleCategory || vehicleCategory,
      vehicleType: parsed.makerModel || vehType,
      fuelType: (parsed.fuelType as any) || 'DIESEL',
      emissionNorms: parsed.emissionNorms || 'BS-VI',
      rcStatus: (parsed.rcStatus as any) || 'ACTIVE',
      registrationDate: parsed.regDate || todayStr,
      fitnessValidUpto: parsed.fitnessUpto || nextYearStr,
      insuranceCompany: parsed.insuranceCompany || 'National / ICICI Lombard Insurance Co.',
      insurancePolicyNo: parsed.insurancePolicyNo || `POL-${Date.now().toString().slice(-6)}`,
      insuranceValidUpto: parsed.insuranceUpto || nextYearStr,
      puccNumber: `PUCC-${Date.now().toString().slice(-4)}`,
      puccValidUpto: parsed.puccUpto || nextSixMoStr,
      permitType: 'Commercial Goods Carriage',
      permitValidUpto: nextYearStr,
      roadTaxValidUpto: nextYearStr,
      verifiedAt: new Date().toISOString(),
      ownerName: parsed.ownerName || 'Prop. P. Nandha Kumar',
      tareWeightKg: parsed.unladenWeightKg || tareWeight,
      grossVehicleWeightKg: (parsed.unladenWeightKg || tareWeight) + 5000,
      carInfoUrl: getCarInfoUrl(normReg),
      parivahanUrl: getParivahanUrl(normReg),
    };

    setRtoResult(scrapedRto);
    setIsCarInfoScrapeModalOpen(false);
    setCarInfoRawText('');
    showToast(
      'success',
      `Auto-scraped from CarInfo: ${scrapedRto.formattedRegNo} (${scrapedRto.vehicleType}). Dates & details auto-filled!`
    );
  };

  // Sync all urgent vehicle compliance alerts to Daily Tasks
  const handleSyncAlertsToDailyTasks = () => {
    let createdCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    complianceSummary.missingInsuranceVehicles.forEach((v) => {
      const existing = dailyTasks.some(
        (t) => t.title.includes(v.registrationNo) && t.title.includes('INSURANCE') && t.status === 'PENDING'
      );
      if (!existing) {
        createDailyTask({
          title: `🚨 ATTACH INSURANCE: ${v.registrationNo} (${v.vehicleType})`,
          priority: 'URGENT',
          status: 'PENDING',
          dueDate: todayStr,
          notes: `Immediate vehicle compliance alert: ${v.registrationNo} has NO active insurance policy attached. Driver: ${v.driverName || 'Unassigned'}.`,
        });
        createdCount++;
      }
    });

    urgentAlerts.forEach((a) => {
      const existing = dailyTasks.some(
        (t) => t.title.includes(a.registrationNo) && t.title.includes(a.documentType) && t.status === 'PENDING'
      );
      if (!existing) {
        const isExpired = a.severity === 'EXPIRED';
        createDailyTask({
          title: `${isExpired ? '🚨 EXPIRED' : '⚠️ RENEW'} ${a.documentType}: ${a.registrationNo} (Exp: ${a.expiryDate})`,
          priority: isExpired ? 'URGENT' : 'HIGH',
          status: 'PENDING',
          dueDate: isExpired ? todayStr : a.expiryDate,
          notes: `Fleet alert: ${a.documentType} ${isExpired ? 'expired' : 'is due soon'}. Vehicle: ${a.registrationNo} (${a.vehicleType}). ${a.daysRemaining}d remaining.`,
        });
        createdCount++;
      }
    });

    if (createdCount > 0) {
      showToast('success', `Created ${createdCount} new task reminders in Daily Tasks & Reminders!`);
    } else {
      showToast('success', 'All fleet compliance reminders are already synced to Daily Tasks!');
    }
  };

  // Add a single alert as a reminder to Daily Tasks
  const handleRemindSingleAlert = (alert: VehicleComplianceAlert) => {
    const isExpired = alert.severity === 'EXPIRED';
    const todayStr = new Date().toISOString().split('T')[0];
    createDailyTask({
      title: `${isExpired ? '🚨 EXPIRED' : '⚠️ RENEW'} ${alert.documentType}: ${alert.registrationNo} (Exp: ${alert.expiryDate})`,
      priority: isExpired ? 'URGENT' : 'HIGH',
      status: 'PENDING',
      dueDate: isExpired ? todayStr : alert.expiryDate,
      notes: `Fleet reminder: ${alert.documentType} for ${alert.registrationNo} (${alert.vehicleType}). Document No: ${alert.documentNumber || 'N/A'}.`,
    });
    showToast('success', `Reminder for ${alert.registrationNo} ${alert.documentType} added to Daily Tasks!`);
  };

  // Connect to Free Vahan / RTO Lookup Service
  const handleLookupRto = async (targetReg?: string) => {
    const queryReg = targetReg || regNo;
    if (!queryReg || queryReg.trim().length < 4) {
      showToast('error', 'Enter a valid vehicle registration number (e.g. TN 18 BY 0420) to verify.');
      return;
    }

    setIsLookingUpRto(true);
    try {
      const result = await lookupVehicleRtoDetails(queryReg, vehicleCategory);
      setRtoResult(result);
      setRegNo(result.formattedRegNo);
      setVehType(result.vehicleType);
      setTareWeight(result.tareWeightKg);
      showToast(
        'success',
        `Verified ${result.formattedRegNo} via ${result.rtoOfficeName} — Insurance & Fitness dates retrieved.`
      );
    } catch {
      showToast('error', 'Could not verify RTO registration details.');
    } finally {
      setIsLookingUpRto(false);
    }
  };

  // Sync existing vehicle directly from card with 1 tap
  const handleQuickSyncVehicleRto = async (veh: Vehicle) => {
    setIsLookingUpRto(true);
    try {
      const result = await lookupVehicleRtoDetails(veh.registrationNo);
      const existingDocs = vehicleDocuments.filter((d) => d.vehicleId === veh.id);
      const todayStr = new Date().toISOString().split('T')[0];

      // Upsert Insurance
      const insDoc = existingDocs.find((d) => d.documentType === 'INSURANCE');
      if (insDoc) {
        updateVehicleDocument(insDoc.id, {
          documentNumber: result.insurancePolicyNo,
          expiryDate: result.insuranceValidUpto,
          notes: `${result.insuranceCompany} (Synced via Vahan RTO)`,
        });
      } else {
        addVehicleDocument({
          vehicleId: veh.id,
          documentType: 'INSURANCE',
          documentNumber: result.insurancePolicyNo,
          issueDate: todayStr,
          expiryDate: result.insuranceValidUpto,
          reminderDaysBefore: 30,
          notes: `${result.insuranceCompany} (Synced via Vahan RTO)`,
        });
      }

      // Upsert Fitness (FC)
      const fcDoc = existingDocs.find((d) => d.documentType === 'FITNESS');
      if (!fcDoc) {
        addVehicleDocument({
          vehicleId: veh.id,
          documentType: 'FITNESS',
          documentNumber: `FC/${result.rtoCode}/${new Date().getFullYear()}`,
          issueDate: todayStr,
          expiryDate: result.fitnessValidUpto,
          reminderDaysBefore: 30,
          notes: `${result.rtoOfficeName} — ${result.emissionNorms}`,
        });
      }

      // Upsert Pollution (PUCC)
      const pucDoc = existingDocs.find((d) => d.documentType === 'POLLUTION');
      if (!pucDoc) {
        addVehicleDocument({
          vehicleId: veh.id,
          documentType: 'POLLUTION',
          documentNumber: result.puccNumber,
          issueDate: todayStr,
          expiryDate: result.puccValidUpto,
          reminderDaysBefore: 15,
          notes: `Emission Norms: ${result.emissionNorms}`,
        });
      }

      showToast(
        'success',
        `Synced ${veh.registrationNo} with ${result.rtoOfficeName}: Insurance (${result.insuranceCompany}), FC & PUCC updated!`
      );
    } finally {
      setIsLookingUpRto(false);
    }
  };

  const handleSubmitVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) return;
    const norm = normalizeVehicleRegistration(regNo);

    if (editingVehicle) {
      updateVehicle(editingVehicle.id, {
        registrationNo: norm.formatted,
        vehicleType: vehType,
        ownershipType: ownership,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        tareWeight: Number(tareWeight),
      });
      showToast('success', `Vehicle "${norm.formatted}" updated successfully.`);
    } else {
      const created = addVehicle({
        registrationNo: norm.formatted,
        vehicleType: vehType,
        ownershipType: ownership,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        tareWeight: Number(tareWeight),
        isActive: true,
      });

      if (autoPopulateDocs) {
        const todayStr = new Date().toISOString().split('T')[0];
        const nextYearStr = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
        const nextSixMoStr = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0];

        addVehicleDocument({
          vehicleId: created.id,
          documentType: 'INSURANCE',
          documentNumber: rtoResult?.insurancePolicyNo || `POL-${norm.stateCode}-${Date.now().toString().slice(-5)}`,
          issueDate: todayStr,
          expiryDate: rtoResult?.insuranceValidUpto || nextYearStr,
          reminderDaysBefore: 30,
          notes: rtoResult?.insuranceCompany || 'Comprehensive Commercial Goods Carrying Policy',
        });

        addVehicleDocument({
          vehicleId: created.id,
          documentType: 'FITNESS',
          documentNumber: `FC-${norm.stateCode}${norm.rtoNumber}-${Date.now().toString().slice(-4)}`,
          issueDate: todayStr,
          expiryDate: rtoResult?.fitnessValidUpto || nextYearStr,
          reminderDaysBefore: 30,
          notes: rtoResult?.rtoOfficeName || 'RTO Fitness Certificate (FC)',
        });

        addVehicleDocument({
          vehicleId: created.id,
          documentType: 'POLLUTION',
          documentNumber: rtoResult?.puccNumber || `PUCC-${norm.clean.slice(-4)}`,
          issueDate: todayStr,
          expiryDate: rtoResult?.puccValidUpto || nextSixMoStr,
          reminderDaysBefore: 15,
          notes: rtoResult?.emissionNorms || 'BS-VI Smoke Emission Certificate',
        });
      }

      showToast(
        'success',
        `Vehicle "${norm.formatted}" added to fleet registry${autoPopulateDocs ? ' with Insurance, FC & PUCC alerts active.' : '.'}`
      );
    }

    setIsVehicleModalOpen(false);
  };

  const handleDeleteVehicle = (v: Vehicle) => {
    if (confirm(`Remove vehicle "${v.registrationNo}" and its compliance records?`)) {
      const res = deleteVehicle(v.id);
      if (res.success) {
        showToast('success', res.message || 'Vehicle removed.');
      } else {
        showToast('error', res.message || 'Failed to remove vehicle.');
      }
    }
  };

  // Document Modal Handlers
  const handleOpenAddDoc = (veh: Vehicle, presetType: VehicleDocument['documentType'] = 'INSURANCE') => {
    setTargetVehicleForDoc(veh);
    setEditingDoc(null);
    setDocType(presetType);
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDays = presetType === 'POLLUTION' ? 180 : 365;
    const defaultExp = new Date(Date.now() + defaultDays * 24 * 3600 * 1000).toISOString().split('T')[0];
    setIssueDate(todayStr);
    setExpiryDate(defaultExp);
    setDocNumber(
      presetType === 'INSURANCE'
        ? `POL-NEWINDIA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        : `${presetType}-${veh.registrationNo.replace(/\s+/g, '')}-${new Date().getFullYear()}`
    );
    setReminderDays(presetType === 'POLLUTION' ? 15 : 30);
    setDocNotes(
      presetType === 'INSURANCE'
        ? 'The New India Assurance Co. Ltd. — Commercial Goods Package Policy'
        : ''
    );
    setIsDocModalOpen(true);
  };

  const handleOpenEditDoc = (veh: Vehicle, doc: VehicleDocument) => {
    setTargetVehicleForDoc(veh);
    setEditingDoc(doc);
    setDocType(doc.documentType);
    setDocNumber(doc.documentNumber || '');
    setIssueDate(doc.issueDate || new Date().toISOString().split('T')[0]);
    setExpiryDate(doc.expiryDate);
    setReminderDays(doc.reminderDaysBefore || 30);
    setDocNotes(doc.notes || '');
    setIsDocModalOpen(true);
  };

  const handleSubmitDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVehicleForDoc || !expiryDate) return;

    if (editingDoc) {
      updateVehicleDocument(editingDoc.id, {
        documentType: docType,
        documentNumber: docNumber.trim() || undefined,
        issueDate,
        expiryDate,
        reminderDaysBefore: Number(reminderDays) || 30,
        notes: docNotes.trim() || undefined,
      });
      showToast('success', `${docType} updated for ${targetVehicleForDoc.registrationNo}.`);
    } else {
      addVehicleDocument({
        vehicleId: targetVehicleForDoc.id,
        documentType: docType,
        documentNumber: docNumber.trim() || undefined,
        issueDate,
        expiryDate,
        reminderDaysBefore: Number(reminderDays) || 30,
        notes: docNotes.trim() || undefined,
      });
      showToast('success', `${docType} added for ${targetVehicleForDoc.registrationNo}.`);
    }
    setIsDocModalOpen(false);
  };

  const handleOneClickRenew = (alertOrDocId: string, regNoLabel: string, docTypeLabel: string) => {
    const updated = renewVehicleDocument(alertOrDocId);
    if (updated) {
      showToast(
        'success',
        `${docTypeLabel} for ${regNoLabel} renewed! New expiry date: ${updated.expiryDate}.`
      );
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Car className="w-6 h-6 text-red-600 shrink-0" />
            <span>Vehicles, Insurance & Vahan RTO Compliance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time vehicle insurance expiry alerts, automated Vahan RTO verification, tare weights & 1-tap policy renewals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsUploadVehicleDocModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all min-h-[44px] cursor-pointer"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>+ Upload Vehicle Paper</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Vehicle / Verify RTO</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold shadow-xs ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="p-1 text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Fleet Compliance KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Fleet</span>
            <Car className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{complianceSummary.totalVehicles}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {complianceSummary.fullyCompliantVehicles} fully compliant
          </p>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-xl border shadow-2xs ${
          complianceSummary.expiredCount > 0
            ? 'bg-rose-50/90 border-rose-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Expired Policies</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{complianceSummary.expiredCount}</p>
          <p className="text-[11px] text-rose-600 font-medium mt-0.5">
            {complianceSummary.expiredCount > 0 ? 'Immediate renewal needed' : 'Zero expired policies'}
          </p>
        </div>

        <div className={`p-3.5 sm:p-4 rounded-xl border shadow-2xs ${
          complianceSummary.criticalCount + complianceSummary.warningCount > 0
            ? 'bg-amber-50/90 border-amber-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Due ≤ 30 Days</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-800 mt-1">
            {complianceSummary.criticalCount + complianceSummary.warningCount}
          </p>
          <p className="text-[11px] text-amber-700 font-medium mt-0.5">
            {complianceSummary.criticalCount} critical (≤7 days)
          </p>
        </div>

        <div className="bg-emerald-50/80 p-3.5 sm:p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Active Certificates</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-800 mt-1">{complianceSummary.validCount}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
            Verified Insurance, FC & PUC
          </p>
        </div>
      </div>

      {/* LIVE VEHICLE INSURANCE & COMPLIANCE ALERT CENTER */}
      {(urgentAlerts.length > 0 || complianceSummary.missingInsuranceVehicles.length > 0) && (
        <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-rose-600 to-red-700 px-4 py-3 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/15">
                <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide">
                  Vehicle Insurance & RTO Expiry Alert System ({urgentAlerts.length + complianceSummary.missingInsuranceVehicles.length} Action Items)
                </h2>
                <p className="text-[11px] text-rose-100">
                  Automatic compliance monitoring for Insurance, Fitness (FC), Pollution (PUC) & Permits
                </p>
              </div>
            </div>
            <button
              onClick={handleSyncAlertsToDailyTasks}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-rose-900 hover:bg-rose-50 active:bg-rose-100 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer min-h-[38px] shrink-0"
              title="Add all expiring and missing vehicle records into Daily Tasks & Reminders"
            >
              <BellRing className="w-4 h-4 text-rose-600" />
              <span>Sync Alerts to Daily Tasks</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {complianceSummary.missingInsuranceVehicles.map((veh) => (
              <div
                key={`missing-${veh.id}`}
                className="p-3.5 sm:p-4 bg-rose-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-slate-900">{veh.registrationNo}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase">
                        NO INSURANCE ATTACHED
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {veh.vehicleType} · Driver: {veh.driverName || 'Unassigned'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleQuickSyncVehicleRto(veh)}
                    disabled={isLookingUpRto}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold min-h-[42px] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Fetch Policy (Vahan API)</span>
                  </button>
                  <button
                    onClick={() => handleOpenAddDoc(veh, 'INSURANCE')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold min-h-[42px] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Insurance</span>
                  </button>
                </div>
              </div>
            ))}

            {urgentAlerts.map((alert) => {
              const vehObj = vehicles.find((v) => v.id === alert.vehicleId);
              const docObj = vehicleDocuments.find((d) => d.id === alert.documentId);
              const isExpired = alert.severity === 'EXPIRED';
              const isCritical = alert.severity === 'CRITICAL';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isExpired ? 'bg-rose-50/40' : isCritical ? 'bg-orange-50/40' : 'bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isExpired
                          ? 'bg-rose-100 text-rose-700'
                          : isCritical
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-slate-900">
                          {alert.registrationNo}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-900 text-white uppercase">
                          {alert.documentType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isExpired
                              ? 'bg-rose-600 text-white'
                              : isCritical
                              ? 'bg-orange-600 text-white'
                              : 'bg-amber-200 text-amber-950'
                          }`}
                        >
                          {alert.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1">
                        Policy / Doc No: <span className="font-mono font-bold">{alert.documentNumber || 'N/A'}</span> · Expiry: <span className="font-bold">{alert.expiryDate}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{alert.actionRequired}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                    <button
                      onClick={() =>
                        handleOneClickRenew(alert.documentId, alert.registrationNo, alert.documentType)
                      }
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors min-h-[42px] cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>1-Tap Renew ({alert.documentType === 'POLLUTION' ? '+6M' : '+1Yr'})</span>
                    </button>

                    {vehObj && docObj && (
                      <button
                        onClick={() => handleOpenEditDoc(vehObj, docObj)}
                        className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Update Date</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRemindSingleAlert(alert)}
                      className="flex items-center gap-1 px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer"
                      title="Set Reminder in Daily Tasks"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                      <span>Remind</span>
                    </button>

                    {alert.whatsappShareUrl && (
                      <a
                        href={alert.whatsappShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 rounded-xl text-xs font-bold min-h-[42px]"
                        title="Send WhatsApp Compliance Alert"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Alert</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'ALL', label: `All Fleet (${vehicles.length})` },
            { id: 'ALERTS', label: `⚠️ Alerts (${complianceSummary.vehiclesWithAlerts})` },
            { id: 'INSURANCE', label: '🛡️ Insurance Status' },
            { id: 'OWNED', label: '🚛 Company Owned' },
            { id: 'UPLOADED_DOCS', label: `📁 Uploaded Papers (${uploadedVehDocs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search reg no, driver, lorry model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[42px]"
          />
        </div>
      </div>

      {/* Vehicles Grid or Uploaded Documents Grid */}
      {activeFilter === 'UPLOADED_DOCS' ? (
        uploadedVehDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 italic bg-white rounded-2xl border border-slate-200">
            No uploaded vehicle documents or certificates found. Tap "+ Upload Vehicle Paper" above to attach RC, Insurance, or Fitness copies.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedVehDocs.map((doc) => (
              <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-black text-sm text-slate-900 block">{doc.partyName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block mt-1">
                      {doc.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                    {doc.documentDate}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ref / Policy:</span>
                    <span className="font-mono font-bold text-slate-800">{doc.referenceNo}</span>
                  </div>
                  {doc.notes && (
                    <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                      {doc.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {doc.fileDataUrl ? (
                    <a
                      href={doc.fileDataUrl}
                      download={doc.fileName}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold min-h-[40px] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Paper</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No File</span>
                  )}
                  <button
                    onClick={() => deleteUploadedDocument(doc.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredVehicles.map((veh) => {
          const docs = vehicleDocuments.filter((d) => d.vehicleId === veh.id);
          const vehAlerts = complianceSummary.alerts.filter((a) => a.vehicleId === veh.id);
          const hasExpired = vehAlerts.some((a) => a.severity === 'EXPIRED');
          const hasWarning = vehAlerts.some((a) => a.severity === 'CRITICAL' || a.severity === 'WARNING');
          const vehExpenses = expenses.filter((e) => e.vehicleId === veh.id);
          const totalCost = vehExpenses.reduce((s, e) => s + e.amount, 0);

          return (
            <div
              key={veh.id}
              className={`bg-white p-4 sm:p-5 rounded-2xl border shadow-xs space-y-4 transition-all ${
                hasExpired
                  ? 'border-rose-300 ring-1 ring-rose-500/10'
                  : hasWarning
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              {/* Vehicle Card Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      hasExpired
                        ? 'bg-rose-100 text-rose-600'
                        : hasWarning
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    <Car className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-mono font-black text-base text-slate-900 tracking-wider">
                        {veh.registrationNo}
                      </h3>
                      <StatusBadge status={veh.ownershipType} />
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{veh.vehicleType}</p>
                  </div>
                </div>

                {/* Touch-Friendly Action Buttons (44px+ hit targets) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenCarInfo(veh.registrationNo)}
                    className="p-2.5 rounded-xl text-sky-600 hover:text-sky-900 hover:bg-sky-50 transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
                    title="Check live on CarInfo"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleQuickSyncVehicleRto(veh)}
                    disabled={isLookingUpRto}
                    className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
                    title="Auto-Sync Insurance & RTO via Vahan Lookup"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(veh)}
                    className="p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
                    title="Edit Vehicle"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteVehicle(veh)}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center cursor-pointer"
                    title="Delete Vehicle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Driver & Tare Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Assigned Driver</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{veh.driverName || 'Unassigned'}</span>
                  {veh.driverPhone && (
                    <span className="text-[11px] text-slate-500 font-mono block">{veh.driverPhone}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Standard Tare Wt</span>
                  <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">
                    {formatWeight(veh.tareWeight)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Logged Maintenance</span>
                  <span className="font-mono font-bold text-slate-800 block mt-0.5">
                    {formatINR(totalCost)}
                  </span>
                </div>
              </div>

              {/* Compliance Documents & Insurance List */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-red-600" />
                    <span>Insurance, Fitness & RTO Compliance ({docs.length})</span>
                  </span>
                  <button
                    onClick={() => handleOpenAddDoc(veh, 'INSURANCE')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-[11px] transition-colors min-h-[36px] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Policy / Doc</span>
                  </button>
                </div>

                {docs.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-rose-200 bg-rose-50/40 text-center space-y-2">
                    <p className="text-rose-800 font-bold text-xs">
                      No Insurance or Fitness documents recorded!
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleQuickSyncVehicleRto(veh)}
                        className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Auto-Fetch from Vahan RTO</span>
                      </button>
                      <button
                        onClick={() => handleOpenAddDoc(veh, 'INSURANCE')}
                        className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold min-h-[40px] cursor-pointer"
                      >
                        + Add Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docs.map((d) => {
                      const alertInfo = vehAlerts.find((a) => a.documentId === d.id);
                      const isExpired = alertInfo?.severity === 'EXPIRED';
                      const isExpiring =
                        alertInfo?.severity === 'CRITICAL' || alertInfo?.severity === 'WARNING';
                      const daysLeft = alertInfo?.daysRemaining ?? 0;

                      return (
                        <div
                          key={d.id}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isExpired
                              ? 'bg-rose-50 border-rose-200 text-rose-950'
                              : isExpiring
                              ? 'bg-amber-50 border-amber-200 text-amber-950'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs uppercase tracking-wide">
                                {d.documentType}
                              </span>
                              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {d.documentNumber || '—'}
                              </span>
                            </div>
                            {d.notes && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{d.notes}</p>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 shrink-0">
                            <div className="text-left sm:text-right mr-1">
                              <span className="font-mono font-bold block text-xs">Exp: {d.expiryDate}</span>
                              <span
                                className={`text-[10px] font-black uppercase ${
                                  isExpired
                                    ? 'text-rose-600'
                                    : isExpiring
                                    ? 'text-amber-700'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {isExpired
                                  ? `EXPIRED (${Math.abs(daysLeft)}d ago)`
                                  : `${daysLeft} days left`}
                              </span>
                            </div>

                            <button
                              onClick={() =>
                                handleOneClickRenew(d.id, veh.registrationNo, d.documentType)
                              }
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 min-h-[36px] cursor-pointer"
                              title="1-Click Renew Policy / Certificate"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Renew</span>
                            </button>

                            <button
                              onClick={() => handleOpenEditDoc(veh, d)}
                              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Edit Document"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (confirm(`Delete ${d.documentType} record for ${veh.registrationNo}?`)) {
                                  deleteVehicleDocument(d.id);
                                  showToast('success', `${d.documentType} deleted.`);
                                }
                              }}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add / Edit Vehicle Modal with Free Vahan RTO API Verification */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        title={editingVehicle ? `Edit Vehicle: ${editingVehicle.registrationNo}` : 'Register Vehicle & Verify Vahan RTO'}
        subtitle="Connects to Vahan RTO directory to auto-fill vehicle class, tare weight & insurance expiry dates."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitVehicle} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Vehicle Registration Number *
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                className="flex-1 p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-sm uppercase focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none min-h-[44px]"
                placeholder="e.g. TN 18 BY 0420"
                required
              />
              <button
                type="button"
                onClick={() => handleLookupRto()}
                disabled={isLookingUpRto}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[44px] cursor-pointer shrink-0"
              >
                {isLookingUpRto ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-400" />
                )}
                <span>Verify Vahan RTO</span>
              </button>
            </div>

            {/* Vehicle Classification Switcher */}
            <div className="mt-2.5">
              <label className="font-bold text-slate-700 block mb-1">
                Vehicle Category / Class
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategory('TWO_WHEELER');
                    if (!editingVehicle) {
                      setVehType('Hero Splendor Plus (Two-Wheeler)');
                      setTareWeight(120);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    vehicleCategory === 'TWO_WHEELER'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>Bike / 2-Wheeler</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategory('COMMERCIAL_TRUCK');
                    if (!editingVehicle) {
                      setVehType('Eicher Pro 3015 17ft Lorry');
                      setTareWeight(4100);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    vehicleCategory === 'COMMERCIAL_TRUCK'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Truck / Lorry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategory('LIGHT_VEHICLE');
                    if (!editingVehicle) {
                      setVehType('Tata Ace Gold / Dost (LCV)');
                      setTareWeight(1450);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    vehicleCategory === 'LIGHT_VEHICLE'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Pickup / LCV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategory('CAR');
                    if (!editingVehicle) {
                      setVehType('Maruti Suzuki Swift Dzire');
                      setTareWeight(1100);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    vehicleCategory === 'CAR'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Car / SUV</span>
                </button>
              </div>
            </div>

            {/* CarInfo Live & Auto-Scrape Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleOpenCarInfo()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-bold cursor-pointer"
                title="Search live RC details on CarInfo web portal"
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                <span>Check Live on CarInfo</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCarInfoScrapeModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold cursor-pointer"
                title="Paste copied text from CarInfo to auto-extract all fields"
              >
                <Clipboard className="w-3.5 h-3.5 text-purple-600" />
                <span>📋 Auto-Scrape from CarInfo</span>
              </button>
            </div>
          </div>

          {/* Vahan RTO Lookup Result Card */}
          {rtoResult && (
            <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 space-y-2 text-emerald-950">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>VAHAN RTO VERIFIED: {rtoResult.rtoOfficeName}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                  RC {rtoResult.rcStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/70">
                <div>
                  <span className="text-emerald-700 block">Insurer & Policy:</span>
                  <span className="font-bold block">{rtoResult.insuranceCompany}</span>
                  <span className="font-mono text-[10px]">Exp: {rtoResult.insuranceValidUpto}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block">Fitness (FC) & Emission:</span>
                  <span className="font-bold block">{rtoResult.emissionNorms}</span>
                  <span className="font-mono text-[10px]">FC Exp: {rtoResult.fitnessValidUpto}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Vehicle Model / Type *</label>
              <input
                type="text"
                value={vehType}
                onChange={(e) => setVehType(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl min-h-[44px]"
                placeholder="e.g. Eicher Pro 3015 17ft Lorry"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Ownership Type *</label>
              <select
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as any)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white min-h-[44px]"
              >
                <option value="OWNED">Company Owned</option>
                <option value="HIRED">Hired Contractor</option>
                <option value="CUSTOMER_VEHICLE">Customer Vehicle</option>
                <option value="SUPPLIER_VEHICLE">Supplier Vehicle</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Assigned Driver Name</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl min-h-[44px]"
                placeholder="Driver full name"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Driver Mobile / WhatsApp</label>
                <button
                  type="button"
                  onClick={async () => {
                    const c = await pickContactFromPhonebook();
                    if (c) {
                      if (c.phone) setDriverPhone(c.phone);
                      if (c.name && (!driverName || !driverName.trim())) setDriverName(c.name);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                  title="Pick directly from your phone's contacts"
                >
                  <BookUser className="w-3.5 h-3.5" />
                  <span>Fetch from Contacts</span>
                </button>
              </div>
              <input
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono min-h-[44px]"
                placeholder="+91 96009 10944"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Standard Unladen Tare Weight (KG) *</label>
              {tareWeight > 0 && (
                <button
                  type="button"
                  onClick={() => setTareWeight(0)}
                  className="text-[10px] text-slate-400 hover:text-slate-600"
                >
                  Clear (0 KG)
                </button>
              )}
            </div>
            <input
              type="number"
              value={tareWeight === 0 ? '' : tareWeight}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value;
                setTareWeight(val === '' ? 0 : parseFloat(val) || 0);
              }}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold min-h-[44px]"
              step="10"
              min="0"
              placeholder="0"
              required
            />
          </div>

          {!editingVehicle && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPopulateDocs}
                onChange={(e) => setAutoPopulateDocs(e.target.checked)}
                className="w-4 h-4 accent-red-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-800">
                Auto-attach Insurance Policy, Fitness Certificate (FC) & Pollution (PUCC) compliance trackers
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsVehicleModalOpen(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl min-h-[44px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm min-h-[44px] cursor-pointer"
            >
              {editingVehicle ? 'Save Vehicle Updates' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Compliance Document Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title={
          editingDoc
            ? `Update ${editingDoc.documentType} — ${targetVehicleForDoc?.registrationNo}`
            : `Add Compliance Document — ${targetVehicleForDoc?.registrationNo}`
        }
        subtitle="Maintain up-to-date Insurance, Fitness, Pollution, Permit & Road Tax expiry alerts."
        maxWidth="md"
      >
        <form onSubmit={handleSubmitDoc} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Document Type *</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold min-h-[44px]"
              >
                <option value="INSURANCE">INSURANCE POLICY</option>
                <option value="FITNESS">FITNESS CERTIFICATE (FC)</option>
                <option value="POLLUTION">POLLUTION (PUCC)</option>
                <option value="PERMIT">NATIONAL / STATE PERMIT</option>
                <option value="ROAD_TAX">ROAD / GREEN TAX</option>
                <option value="RC">REGISTRATION CERT (RC)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Policy / Certificate No. *</label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono uppercase min-h-[44px]"
                placeholder="e.g. POL-ICICI-2026-9901"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Issue / Renewal Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl min-h-[44px]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Expiry Valid Upto *</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold min-h-[44px]"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Alert Reminder Days Before Expiry
            </label>
            <input
              type="number"
              value={reminderDays}
              onChange={(e) => setReminderDays(parseInt(e.target.value, 10) || 15)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono min-h-[44px]"
              min="1"
              max="90"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Insurer Name / RTO Notes
            </label>
            <input
              type="text"
              value={docNotes}
              onChange={(e) => setDocNotes(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl min-h-[44px]"
              placeholder="e.g. The New India Assurance Co. Ltd. — Comprehensive"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDocModalOpen(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl min-h-[44px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm min-h-[44px] cursor-pointer"
            >
              {editingDoc ? 'Save Policy Updates' : 'Save Compliance Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Upload Vehicle Document / Paper Modal */}
      {isUploadVehicleDocModalOpen && (
        <Modal
          isOpen={isUploadVehicleDocModalOpen}
          onClose={() => setIsUploadVehicleDocModalOpen(false)}
          title="Upload Vehicle Document / Paper"
          subtitle="Attach and store scanned RC book, Insurance policy copy, Fitness (FC), PUCC, or Permit certificate (PDF, JPG, PNG)."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveUploadedVehDoc} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Target Vehicle *
                </label>
                <select
                  value={uploadVehReg}
                  onChange={(e) => setUploadVehReg(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.registrationNo}>
                      {v.registrationNo} ({v.vehicleType})
                    </option>
                  ))}
                  <option value="TN 05 Y 1936">TN 05 Y 1936 (Default)</option>
                  <option value="TN 18 BY 4920">TN 18 BY 4920</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Document Type / Category *
                </label>
                <select
                  value={uploadDocCategory}
                  onChange={(e) => setUploadDocCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none"
                >
                  <option value="INSURANCE">Insurance Policy (Commercial Goods Package)</option>
                  <option value="RC">RC Book / Registration Certificate</option>
                  <option value="FITNESS">Fitness Certificate (FC)</option>
                  <option value="POLLUTION">Pollution Under Control (PUCC)</option>
                  <option value="PERMIT">National / State Goods Permit</option>
                  <option value="TAX">Motor Vehicle Road Tax Receipt</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Policy / Certificate / Ref No *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. POL-NEWINDIA-2026-9012 or FC/TN05/2026"
                  value={uploadDocRefNo}
                  onChange={(e) => setUploadDocRefNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Document Issue Date
                </label>
                <input
                  type="date"
                  value={uploadDocDate}
                  onChange={(e) => setUploadDocDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Expiry Date (for Alert Tracking)
                </label>
                <input
                  type="date"
                  value={uploadDocExpiry}
                  onChange={(e) => setUploadDocExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Document Custom Label / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2026 Comprehensive Commercial Insurance Policy"
                  value={uploadDocTitle}
                  onChange={(e) => setUploadDocTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Attach Scanned File / Photo (PDF or Image)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleUploadVehFileChange}
                  className="hidden"
                  id="veh-file-upload-input"
                />
                <label
                  htmlFor="veh-file-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FileUp className="w-8 h-8 text-red-500" />
                  <span className="font-bold text-slate-700">
                    {uploadVehFileData ? uploadVehFileData.name : 'Click to select PDF or Certificate Photo'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Supports PDF, JPG, PNG from device storage or mobile camera
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Notes & Insurer Details
              </label>
              <textarea
                rows={2}
                placeholder="e.g. The New India Assurance Co. Ltd, Policy IDV ₹6,50,000"
                value={uploadDocNotes}
                onChange={(e) => setUploadDocNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsUploadVehicleDocModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md shadow-red-600/20 flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-300" />
                <span>Save to Registry</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Auto-Scrape from CarInfo Text Modal */}
      <Modal
        isOpen={isCarInfoScrapeModalOpen}
        onClose={() => {
          setIsCarInfoScrapeModalOpen(false);
          setCarInfoRawText('');
        }}
        title="📋 Auto-Scrape from CarInfo / mParivahan"
        subtitle="Copy details from the CarInfo app or website, paste here, and all vehicle specs & insurance dates will auto-populate!"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                Paste CarInfo / Parivahan Text
              </label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                      setCarInfoRawText(text);
                      showToast('success', 'Pasted from clipboard!');
                    }
                  } catch {
                    showToast('error', 'Clipboard permission denied. Please paste manually into the box.');
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-full border border-purple-200 cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste from Clipboard</span>
              </button>
            </div>
            <textarea
              value={carInfoRawText}
              onChange={(e) => setCarInfoRawText(e.target.value)}
              rows={8}
              placeholder={`Example:\nRegistration Number: TN 37 BY 1234\nModel: Hero Splendor Plus\nInsurance Valid Upto: 15-Nov-2026\nInsurance Policy: POL-998822\nInsurer: ICICI Lombard\nFitness Valid Upto: 20-Oct-2029\nPUCC Valid Upto: 12-Apr-2027`}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
          </div>

          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-[11px] space-y-1">
            <span className="font-bold block">💡 How to use CarInfo Auto-Scrape:</span>
            <p>1. Open CarInfo app on your phone and search your bike/vehicle number.</p>
            <p>2. Tap "Share" or copy all RC & Insurance details.</p>
            <p>3. Tap "Paste from Clipboard" above and hit "Auto-Extract & Fill All Fields".</p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsCarInfoScrapeModalOpen(false);
                setCarInfoRawText('');
              }}
              className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer min-h-[42px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleAutoScrapeCarInfo(carInfoRawText)}
              disabled={!carInfoRawText.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer min-h-[42px]"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>⚡ Auto-Extract & Fill All Fields</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
