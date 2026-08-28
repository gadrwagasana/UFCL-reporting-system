import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Modal, Pressable, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader } from '../../components/AppHeader';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LoadingState } from '../../components/LoadingState';
import { DatePickerField } from '../../components/DatePickerField';
import { FormSelect } from '../../components/FormSelect';
import { StatusBadge } from '../../components/StatusBadge';
import { SparklineChart } from '../../components/SparklineChart';
import {
  useProcurementSuppliers, useProcurementSupplierContacts, useProcurementSupplierContracts,
  useProcurementSupplierActions,
} from '../../hooks/useProcurementSuppliers';
import { useSupplierIntelligenceProfile } from '../../hooks/useProcurementIntelligence';
import {
  useSrmComplianceList, useSrmDocuments, useSrmCommunications, useSrmImprovementPlans, useSrmActions,
} from '../../hooks/useSrm';
import { useAuth } from '../../hooks/useAuth';
import { showToast } from '../../stores/toastStore';
import { ProcurementStackParamList } from '../../navigation/types';
import type {
  ProcurementSupplierContact, ProcurementSupplierContract, ProcurementSupplierStatus,
  SrmComplianceListItem, SrmDocument, SrmCommunication, SrmImprovementPlan,
} from '../../types/api';
import { SRM_COMPLIANCE_TYPES } from '../../types/api';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

const TIER_COLOR: Record<string, string> = { Excellent: Colors.success, Good: Colors.navy, Average: Colors.warning, 'High Risk': Colors.error };

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? Colors.success : value >= 60 ? Colors.navy : value >= 40 ? Colors.warning : Colors.error;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: Typography.xs, color: Colors.textMuted }}>{label}</Text>
        <Text style={{ fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textPrimary }}>{value}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: Colors.border, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${value}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

type NavProp = NativeStackNavigationProp<ProcurementStackParamList, 'SupplierDetail'>;
type RouteType = RouteProp<ProcurementStackParamList, 'SupplierDetail'>;

// Roles allowed to perform supplier governance actions (activate/deactivate/
// blacklist/restore/delete/contract-approve/compliance-waive) — mirrors the
// centralized 'procurement-suppliers-governance' permission granted
// server-side in db/migrate.js (admin/ceo/procurement-manager;
// procurement-officer keeps full SRM CRUD but not governance). Mobile has no
// resolved-permissions fetch the way desktop's STORAGE.pages does, so this
// list is a client-only UX hint kept in sync with the backend grant — the
// server remains the authoritative check on every governance function.
const GOVERNANCE_ROLES = ['admin', 'ceo', 'procurement-manager'];

// Sections a 600+ line single-scroll screen was split into for Phase 4 SRM —
// see SUPPLIER_RELATIONSHIP_PHASE4_COMPLETION_REPORT.md "UI/CSS Improvements".
const TABS = [
  { key: 'overview',      label: 'Overview',      icon: 'grid-outline' as const },
  { key: 'contracts',     label: 'Contracts',      icon: 'document-text-outline' as const },
  { key: 'compliance',    label: 'Compliance',     icon: 'shield-checkmark-outline' as const },
  { key: 'documents',     label: 'Documents',      icon: 'folder-outline' as const },
  { key: 'communications', label: 'Communications', icon: 'chatbubbles-outline' as const },
  { key: 'improvements',  label: 'Improvements',   icon: 'construct-outline' as const },
  { key: 'intelligence',  label: 'Intelligence',   icon: 'analytics-outline' as const },
];
type TabKey = typeof TABS[number]['key'];

function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
      {TABS.map((t) => (
        <TouchableOpacity key={t.key} style={[styles.tabItem, active === t.key && styles.tabItemActive]} onPress={() => onChange(t.key)}>
          <Ionicons name={t.icon} size={15} color={active === t.key ? Colors.white : Colors.textMuted} />
          <Text style={[styles.tabItemText, active === t.key && styles.tabItemTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as never} size={16} color={Colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Generic reason modal — status changes, contract approval, etc. ─────────
function StatusReasonModal({ visible, title, actionLabel, placeholder, danger, onClose, onConfirm }: {
  visible: boolean; title: string; actionLabel: string; placeholder?: string; danger?: boolean;
  onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function confirm() {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    onConfirm(reason.trim());
    setReason('');
    setError('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{title}</Text>
        <Text style={sheetStyles.label}>Reason *</Text>
        <TextInput
          style={[sheetStyles.input, error ? sheetStyles.inputError : null]}
          value={reason}
          onChangeText={(v) => { setReason(v); if (error) setError(''); }}
          placeholder={placeholder ?? 'Why is this status changing?'}
          placeholderTextColor={Colors.textMuted}
          multiline
          autoFocus
        />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={danger ? sheetStyles.dangerBtn : sheetStyles.saveBtn} onPress={confirm}>
            <Text style={danger ? sheetStyles.dangerText : sheetStyles.saveText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Contact add/edit modal ──────────────────────────────────────────────────
function ContactFormModal({ visible, initial, onClose, onSave }: {
  visible: boolean;
  initial: ProcurementSupplierContact | null;
  onClose: () => void;
  onSave: (payload: Partial<ProcurementSupplierContact>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? ''); setRole(initial?.role ?? ''); setPhone(initial?.phone ?? '');
      setEmail(initial?.email ?? ''); setIsPrimary(initial?.is_primary ?? false); setError('');
    }
  }, [visible, initial]);

  function save() {
    if (!name.trim()) { setError('Contact name is required.'); return; }
    onSave({ name: name.trim(), role: role.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined, is_primary: isPrimary });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{initial ? 'Edit Contact' : 'Add Contact'}</Text>
        <Text style={sheetStyles.label}>Name *</Text>
        <TextInput style={sheetStyles.input} value={name} onChangeText={setName} placeholderTextColor={Colors.textMuted} />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <Text style={sheetStyles.label}>Role</Text>
        <TextInput style={sheetStyles.input} value={role} onChangeText={setRole} placeholderTextColor={Colors.textMuted} />
        <Text style={sheetStyles.label}>Phone</Text>
        <TextInput style={sheetStyles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.textMuted} />
        <Text style={sheetStyles.label}>Email</Text>
        <TextInput style={sheetStyles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.toggleRow}>
          <Text style={sheetStyles.label}>Primary contact</Text>
          <Switch value={isPrimary} onValueChange={setIsPrimary} trackColor={{ false: Colors.border, true: Colors.navy }} thumbColor={Colors.white} />
        </View>
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>{initial ? 'Save Changes' : 'Add Contact'}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Contract add/edit modal (Phase 4 — category/value/owner/renewal-notice
// added; creation always lands in 'draft' server-side regardless of what's
// sent here, so no status field is offered on create) ─────────────────────
function ContractFormModal({ visible, initial, onClose, onSave }: {
  visible: boolean;
  initial: ProcurementSupplierContract | null;
  onClose: () => void;
  onSave: (payload: Partial<ProcurementSupplierContract>) => void;
}) {
  const [ref, setRef] = useState(initial?.contract_ref ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [startDate, setStartDate] = useState<string | null>(initial?.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(initial?.end_date ?? null);
  const [value, setValue] = useState(initial?.contract_value != null ? String(initial.contract_value) : '');
  const [renewalNoticeDays, setRenewalNoticeDays] = useState(initial?.renewal_notice_days != null ? String(initial.renewal_notice_days) : '');
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setRef(initial?.contract_ref ?? ''); setCategory(initial?.category ?? '');
      setStartDate(initial?.start_date ?? null); setEndDate(initial?.end_date ?? null);
      setValue(initial?.contract_value != null ? String(initial.contract_value) : '');
      setRenewalNoticeDays(initial?.renewal_notice_days != null ? String(initial.renewal_notice_days) : '');
      setTerms(initial?.terms ?? ''); setNotes(initial?.notes ?? ''); setError('');
    }
  }, [visible, initial]);

  function save() {
    if (!ref.trim()) { setError('Contract reference is required.'); return; }
    onSave({
      contract_ref: ref.trim(), category: category.trim() || undefined,
      start_date: startDate ?? undefined, end_date: endDate ?? undefined,
      contract_value: value.trim() ? Number(value) : undefined,
      renewal_notice_days: renewalNoticeDays.trim() ? Number(renewalNoticeDays) : undefined,
      terms: terms.trim() || undefined, notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <ScrollView style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{initial ? 'Edit Contract' : 'Add Contract (starts as Draft)'}</Text>
        <Text style={sheetStyles.label}>Contract Ref *</Text>
        <TextInput style={sheetStyles.input} value={ref} onChangeText={setRef} placeholderTextColor={Colors.textMuted} />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <Text style={sheetStyles.label}>Category</Text>
        <TextInput style={sheetStyles.input} value={category} onChangeText={setCategory} placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.row}>
          <View style={{ flex: 1 }}><DatePickerField label="Start Date" value={startDate} onChange={setStartDate} /></View>
          <View style={{ flex: 1 }}><DatePickerField label="End Date" value={endDate} onChange={setEndDate} /></View>
        </View>
        <Text style={sheetStyles.label}>Contract Value</Text>
        <TextInput style={sheetStyles.input} value={value} onChangeText={setValue} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
        <Text style={sheetStyles.label}>Renewal Notice (days)</Text>
        <TextInput style={sheetStyles.input} value={renewalNoticeDays} onChangeText={setRenewalNoticeDays} keyboardType="numeric" placeholder="90" placeholderTextColor={Colors.textMuted} />
        <Text style={sheetStyles.label}>Terms</Text>
        <TextInput style={sheetStyles.input} value={terms} onChangeText={setTerms} multiline placeholderTextColor={Colors.textMuted} />
        <Text style={sheetStyles.label}>Notes</Text>
        <TextInput style={sheetStyles.input} value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>{initial ? 'Save Changes' : 'Add Contract'}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

// ── Renew contract modal — creates a new linked contract row server-side ──
function RenewContractModal({ visible, contract, onClose, onSave }: {
  visible: boolean; contract: ProcurementSupplierContract | null;
  onClose: () => void; onSave: (payload: { end_date: string; start_date?: string; contract_value?: number }) => void;
}) {
  const [endDate, setEndDate] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => { if (visible) { setEndDate(null); setValue(contract?.contract_value != null ? String(contract.contract_value) : ''); setError(''); } }, [visible, contract]);

  function save() {
    if (!endDate) { setError('A new end date is required.'); return; }
    onSave({ end_date: endDate, contract_value: value.trim() ? Number(value) : undefined });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>Renew {contract?.contract_ref}</Text>
        <DatePickerField label="New End Date" value={endDate} onChange={setEndDate} required />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <Text style={sheetStyles.label}>Contract Value</Text>
        <TextInput style={sheetStyles.input} value={value} onChangeText={setValue} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>Renew Contract</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Compliance upsert modal ─────────────────────────────────────────────────
function ComplianceFormModal({ visible, initial, canWaive, onClose, onSave }: {
  visible: boolean; initial: SrmComplianceListItem | null; canWaive: boolean;
  onClose: () => void; onSave: (payload: Partial<SrmComplianceListItem>) => void;
}) {
  const [issueDate, setIssueDate] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [waived, setWaived] = useState(false);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (visible) {
      setIssueDate(initial?.issue_date ?? null);
      setExpiryDate(initial?.expiry_date ?? null);
      setWaived(initial?.status === 'waived');
      setNotes(initial?.notes ?? '');
    }
  }, [visible, initial]);

  function save() {
    onSave({
      compliance_type: initial?.compliance_type,
      issue_date: issueDate ?? undefined, expiry_date: expiryDate ?? undefined,
      status: waived ? 'waived' : 'valid', notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{initial?.compliance_type}</Text>
        <View style={sheetStyles.row}>
          <View style={{ flex: 1 }}><DatePickerField label="Issue Date" value={issueDate} onChange={setIssueDate} /></View>
          <View style={{ flex: 1 }}><DatePickerField label="Expiry Date" value={expiryDate} onChange={setExpiryDate} /></View>
        </View>
        {canWaive ? (
          <View style={sheetStyles.toggleRow}>
            <Text style={sheetStyles.label}>Waive this requirement</Text>
            <Switch value={waived} onValueChange={setWaived} trackColor={{ false: Colors.border, true: Colors.navy }} thumbColor={Colors.white} />
          </View>
        ) : null}
        <Text style={sheetStyles.label}>Notes</Text>
        <TextInput style={sheetStyles.input} value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>Save</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Document upload modal ───────────────────────────────────────────────────
const DOCUMENT_TYPES = ['Contract Document', 'Compliance Certificate', 'Insurance', 'Tax Document', 'Quality Certificate', 'Attachment'];

function DocumentUploadModal({ visible, onClose, onUpload }: {
  visible: boolean; onClose: () => void;
  onUpload: (file: { uri: string; name: string; mimeType?: string | null }, meta: { document_type: string; expiry_date?: string; notes?: string }) => void;
}) {
  const [picked, setPicked] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(null);
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => { if (visible) { setPicked(null); setDocType(DOCUMENT_TYPES[0]); setExpiryDate(null); setNotes(''); setError(''); } }, [visible]);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setPicked({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  }

  function save() {
    if (!picked) { setError('Select a file to upload.'); return; }
    onUpload(picked, { document_type: docType, expiry_date: expiryDate ?? undefined, notes: notes.trim() || undefined });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>Upload Document</Text>
        <TouchableOpacity style={pickerStyles.picker} onPress={pickFile}>
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.navy} />
          <Text style={pickerStyles.pickerText} numberOfLines={1}>{picked?.name ?? 'Choose a file…'}</Text>
        </TouchableOpacity>
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <FormSelect label="Document Type" options={DOCUMENT_TYPES.map((t) => ({ label: t, value: t }))} value={docType} onChange={(v) => setDocType(String(v))} />
        <DatePickerField label="Expiry Date (optional)" value={expiryDate} onChange={setExpiryDate} />
        <Text style={sheetStyles.label}>Notes</Text>
        <TextInput style={sheetStyles.input} value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>Upload</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Communication add/edit modal ────────────────────────────────────────────
const COMMUNICATION_TYPES = ['Meeting', 'Call', 'Email', 'Site Visit', 'Negotiation', 'Complaint'];

function CommunicationFormModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: SrmCommunication | null;
  onClose: () => void; onSave: (payload: Partial<SrmCommunication>) => void;
}) {
  const [type, setType] = useState(initial?.communication_type ?? COMMUNICATION_TYPES[0]);
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [nextAction, setNextAction] = useState(initial?.next_action ?? '');
  const [nextActionDate, setNextActionDate] = useState<string | null>(initial?.next_action_date ?? null);
  const [date, setDate] = useState<string | null>(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setType(initial?.communication_type ?? COMMUNICATION_TYPES[0]); setSubject(initial?.subject ?? '');
      setNotes(initial?.notes ?? ''); setNextAction(initial?.next_action ?? '');
      setNextActionDate(initial?.next_action_date ?? null); setDate(initial?.date ?? new Date().toISOString().slice(0, 10));
      setError('');
    }
  }, [visible, initial]);

  function save() {
    if (!subject.trim()) { setError('Subject is required.'); return; }
    onSave({ communication_type: type, subject: subject.trim(), notes: notes.trim() || undefined, next_action: nextAction.trim() || undefined, next_action_date: nextActionDate ?? undefined, date: date ?? undefined });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <ScrollView style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{initial ? 'Edit Communication' : 'Log Communication'}</Text>
        <FormSelect label="Type" options={COMMUNICATION_TYPES.map((t) => ({ label: t, value: t }))} value={type} onChange={(v) => setType(String(v))} required />
        <Text style={sheetStyles.label}>Subject *</Text>
        <TextInput style={sheetStyles.input} value={subject} onChangeText={setSubject} placeholderTextColor={Colors.textMuted} />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <DatePickerField label="Date" value={date} onChange={setDate} />
        <Text style={sheetStyles.label}>Notes</Text>
        <TextInput style={sheetStyles.input} value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.textMuted} />
        <Text style={sheetStyles.label}>Next Action</Text>
        <TextInput style={sheetStyles.input} value={nextAction} onChangeText={setNextAction} placeholderTextColor={Colors.textMuted} />
        <DatePickerField label="Next Action Date" value={nextActionDate} onChange={setNextActionDate} />
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>{initial ? 'Save Changes' : 'Log Entry'}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

// ── Improvement plan add/edit modal ─────────────────────────────────────────
const PLAN_TYPES = ['corrective_action', 'development', 'training', 'review'];
const PLAN_STATUSES = ['open', 'in_progress', 'closed', 'completed'];

function ImprovementPlanFormModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: SrmImprovementPlan | null;
  onClose: () => void; onSave: (payload: Partial<SrmImprovementPlan>) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [planType, setPlanType] = useState(initial?.plan_type ?? PLAN_TYPES[0]);
  const [status, setStatus] = useState(initial?.status ?? PLAN_STATUSES[0]);
  const [dueDate, setDueDate] = useState<string | null>(initial?.due_date ?? null);
  const [completion, setCompletion] = useState(initial?.completion_percent != null ? String(initial.completion_percent) : '0');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? ''); setDescription(initial?.description ?? '');
      setPlanType(initial?.plan_type ?? PLAN_TYPES[0]); setStatus(initial?.status ?? PLAN_STATUSES[0]);
      setDueDate(initial?.due_date ?? null); setCompletion(initial?.completion_percent != null ? String(initial.completion_percent) : '0');
      setError('');
    }
  }, [visible, initial]);

  function save() {
    if (!title.trim()) { setError('Title is required.'); return; }
    const pct = Math.max(0, Math.min(100, Number(completion) || 0));
    onSave({ title: title.trim(), description: description.trim() || undefined, plan_type: planType, status, due_date: dueDate ?? undefined, completion_percent: pct });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <ScrollView style={sheetStyles.sheet}>
        <Text style={sheetStyles.title}>{initial ? 'Edit Improvement Plan' : 'New Improvement Plan'}</Text>
        <Text style={sheetStyles.label}>Title *</Text>
        <TextInput style={sheetStyles.input} value={title} onChangeText={setTitle} placeholderTextColor={Colors.textMuted} />
        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}
        <Text style={sheetStyles.label}>Description</Text>
        <TextInput style={sheetStyles.input} value={description} onChangeText={setDescription} multiline placeholderTextColor={Colors.textMuted} />
        <FormSelect label="Plan Type" options={PLAN_TYPES.map((t) => ({ label: t.replace('_', ' '), value: t }))} value={planType} onChange={(v) => setPlanType(String(v))} />
        {initial ? <FormSelect label="Status" options={PLAN_STATUSES.map((s) => ({ label: s.replace('_', ' '), value: s }))} value={status} onChange={(v) => setStatus(String(v))} /> : null}
        <DatePickerField label="Due Date" value={dueDate} onChange={setDueDate} />
        <Text style={sheetStyles.label}>Completion %</Text>
        <TextInput style={sheetStyles.input} value={completion} onChangeText={setCompletion} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
        <View style={sheetStyles.actions}>
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}><Text style={sheetStyles.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={sheetStyles.saveBtn} onPress={save}><Text style={sheetStyles.saveText}>{initial ? 'Save Changes' : 'Create Plan'}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

interface StatusAction { target: ProcurementSupplierStatus; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }

// Mirrors desktop's supplierGovernanceButtons() — the action set changes
// with lifecycle status (an already-blacklisted supplier gets "Restore",
// not "Blacklist" again).
function actionsForStatus(status: ProcurementSupplierStatus): StatusAction[] {
  if (status === 'blacklisted') {
    return [{ target: 'active', label: 'Restore Supplier', icon: 'refresh-outline' }];
  }
  if (status === 'active') {
    return [
      { target: 'suspended', label: 'Deactivate Supplier', icon: 'pause-circle-outline' },
      { target: 'blacklisted', label: 'Blacklist Supplier', icon: 'ban-outline', danger: true },
    ];
  }
  return [{ target: 'active', label: 'Activate Supplier', icon: 'checkmark-circle-outline' }];
}

const COMPLIANCE_STATUS_COLOR: Record<string, string> = {
  active: Colors.success, expiring: Colors.warning, expired: Colors.error, missing: Colors.textMuted, waived: Colors.navy,
};

export function SupplierDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const { params } = useRoute<RouteType>();
  const { role } = useAuth();
  const { data: listData, isLoading } = useProcurementSuppliers();
  const { data: contactsData } = useProcurementSupplierContacts(params.supplierId);
  const { data: contractsData } = useProcurementSupplierContracts(params.supplierId);
  const { data: intelData } = useSupplierIntelligenceProfile(params.supplierId);
  const { setStatus, remove, addContact, updateContact, removeContact, addContract, updateContract } = useProcurementSupplierActions();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { data: complianceData } = useSrmComplianceList(params.supplierId);
  const { data: documentsData } = useSrmDocuments(params.supplierId);
  const { data: communicationsData } = useSrmCommunications(params.supplierId);
  const { data: improvementPlansData } = useSrmImprovementPlans(params.supplierId);
  const srm = useSrmActions();

  const supplier = listData?.rows.find((s) => s.id === params.supplierId);
  const canGovern = role ? GOVERNANCE_ROLES.includes(role) : false;

  const [statusModal, setStatusModal] = useState<StatusAction | null>(null);
  const [archiveFallbackOpen, setArchiveFallbackOpen] = useState(false);
  const [deleteBlockedReason, setDeleteBlockedReason] = useState('');
  const [contactModal, setContactModal] = useState<{ open: boolean; editing: ProcurementSupplierContact | null }>({ open: false, editing: null });
  const [contractModal, setContractModal] = useState<{ open: boolean; editing: ProcurementSupplierContract | null }>({ open: false, editing: null });
  const [renewModal, setRenewModal] = useState<ProcurementSupplierContract | null>(null);
  const [approveReasonModal, setApproveReasonModal] = useState<ProcurementSupplierContract | null>(null);
  const [complianceModal, setComplianceModal] = useState<SrmComplianceListItem | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [commModal, setCommModal] = useState<{ open: boolean; editing: SrmCommunication | null }>({ open: false, editing: null });
  const [planModal, setPlanModal] = useState<{ open: boolean; editing: SrmImprovementPlan | null }>({ open: false, editing: null });
  const [busy, setBusy] = useState(false);

  if (isLoading || !supplier) return <LoadingState message="Loading supplier…" fullScreen />;

  function errMsg(e: any, fallback: string) {
    return e?.response?.data?.error?.message ?? e?.message ?? fallback;
  }

  async function onStatusReason(reason: string) {
    if (!statusModal) return;
    const target = statusModal.target;
    setStatusModal(null);
    try {
      await setStatus(supplier!.id, target, reason);
      showToast('Supplier status updated.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not update supplier.'), 'error');
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete supplier?',
      `Delete "${supplier!.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await remove(supplier!.id);
              showToast('Supplier deleted.');
              navigation.goBack();
            } catch (e: any) {
              const message = errMsg(e, 'Could not delete supplier.');
              if (/procurement history exists/i.test(message)) {
                setDeleteBlockedReason(message);
                setArchiveFallbackOpen(true);
              } else {
                showToast(message, 'error');
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  async function onArchiveInstead(reason: string) {
    setArchiveFallbackOpen(false);
    try {
      await setStatus(supplier!.id, 'archived', reason);
      showToast('Supplier archived.');
      navigation.goBack();
    } catch (e: any) {
      showToast(errMsg(e, 'Could not archive supplier.'), 'error');
    }
  }

  async function onSaveContact(payload: Partial<ProcurementSupplierContact>) {
    try {
      if (contactModal.editing) await updateContact(supplier!.id, contactModal.editing.id, payload);
      else await addContact(supplier!.id, payload);
      setContactModal({ open: false, editing: null });
      showToast(contactModal.editing ? 'Contact updated.' : 'Contact added.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not save contact.'), 'error');
    }
  }

  function confirmDeleteContact(c: ProcurementSupplierContact) {
    Alert.alert('Delete contact?', `Remove "${c.name}" from this supplier's contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await removeContact(supplier!.id, c.id); showToast('Contact deleted.'); }
          catch (e: any) { showToast(errMsg(e, 'Could not delete contact.'), 'error'); }
        },
      },
    ]);
  }

  async function onSaveContract(payload: Partial<ProcurementSupplierContract>) {
    try {
      if (contractModal.editing) await updateContract(supplier!.id, contractModal.editing.id, payload);
      else await addContract(supplier!.id, payload);
      setContractModal({ open: false, editing: null });
      showToast(contractModal.editing ? 'Contract updated.' : 'Contract added — pending approval.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not save contract.'), 'error');
    }
  }

  async function onApproveContract(reason: string) {
    if (!approveReasonModal) return;
    const c = approveReasonModal;
    setApproveReasonModal(null);
    try {
      await srm.approveContract(c.id, reason);
      showToast('Contract approved.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not approve contract.'), 'error');
    }
  }

  async function onRenewContract(payload: { end_date: string; start_date?: string; contract_value?: number }) {
    if (!renewModal) return;
    try {
      await srm.renewContract(renewModal.id, payload);
      setRenewModal(null);
      showToast('Contract renewed.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not renew contract.'), 'error');
    }
  }

  async function onSaveCompliance(payload: Partial<SrmComplianceListItem>) {
    try {
      await srm.upsertCompliance(supplier!.id, payload);
      setComplianceModal(null);
      showToast('Compliance record updated.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not update compliance record.'), 'error');
    }
  }

  async function onUploadDocument(file: { uri: string; name: string; mimeType?: string | null }, meta: { document_type: string; expiry_date?: string; notes?: string }) {
    try {
      await srm.uploadDocument(supplier!.id, file, meta);
      setUploadModalOpen(false);
      showToast('Document uploaded.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not upload document.'), 'error');
    }
  }

  async function onDownloadDocument(d: SrmDocument) {
    try {
      await srm.downloadDocument(d.id, d.original_filename);
    } catch (e: any) {
      showToast(errMsg(e, 'Could not download document.'), 'error');
    }
  }

  function confirmDeleteDocument(d: SrmDocument) {
    Alert.alert('Delete document?', `Remove "${d.original_filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await srm.deleteDocument(supplier!.id, d.id); showToast('Document deleted.'); }
          catch (e: any) { showToast(errMsg(e, 'Could not delete document.'), 'error'); }
        },
      },
    ]);
  }

  async function onSaveCommunication(payload: Partial<SrmCommunication>) {
    try {
      if (commModal.editing) await srm.updateCommunication(supplier!.id, commModal.editing.id, payload);
      else await srm.createCommunication(supplier!.id, payload);
      setCommModal({ open: false, editing: null });
      showToast(commModal.editing ? 'Communication updated.' : 'Communication logged.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not save communication.'), 'error');
    }
  }

  async function onSavePlan(payload: Partial<SrmImprovementPlan>) {
    try {
      if (planModal.editing) await srm.updateImprovementPlan(supplier!.id, planModal.editing.id, payload);
      else await srm.createImprovementPlan(supplier!.id, payload);
      setPlanModal({ open: false, editing: null });
      showToast(planModal.editing ? 'Plan updated.' : 'Improvement plan created.');
    } catch (e: any) {
      showToast(errMsg(e, 'Could not save improvement plan.'), 'error');
    }
  }

  const governanceActions = actionsForStatus(supplier.status ?? 'active');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <OfflineBanner />
      <AppHeader
        title={supplier.name}
        dark
        onBack={() => navigation.goBack()}
        actions={[{ icon: 'create-outline', onPress: () => navigation.navigate('SupplierForm', { supplier }) }]}
      />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {activeTab === 'overview' ? (
          <>
            <View style={styles.statusRow}>
              <StatusBadge status={supplier.status ?? 'active'} withIcon />
              {supplier.preferred ? (
                <View style={styles.preferredPill}><Ionicons name="star" size={12} color={Colors.orange} /><Text style={styles.preferredPillText}>Preferred</Text></View>
              ) : null}
            </View>

            {supplier.blacklisted ? (
              <View style={styles.blacklistBanner}>
                <Ionicons name="ban" size={16} color={Colors.error} />
                <Text style={styles.blacklistBannerText}>Blacklisted{supplier.blacklist_reason ? `: ${supplier.blacklist_reason}` : ''}</Text>
              </View>
            ) : null}
            {supplier.status_reason && supplier.status !== 'blacklisted' ? (
              <View style={styles.reasonBanner}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.reasonBannerText}>{supplier.status_reason}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Details</Text>
              <Row icon="pricetag-outline" label="Category" value={supplier.category} />
              <Row icon="call-outline" label="Phone" value={supplier.phone} />
              <Row icon="mail-outline" label="Email" value={supplier.email} />
              <Row icon="location-outline" label="Address" value={supplier.address} />
              <Row icon="document-text-outline" label="Tax Number" value={supplier.tax_number} />
              <Row icon="card-outline" label="Bank" value={supplier.bank_name ? `${supplier.bank_name} · ${supplier.bank_account ?? ''}` : null} />
              <Row icon="chatbox-outline" label="Notes" value={supplier.notes} />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Contacts</Text>
                <TouchableOpacity style={styles.addLink} onPress={() => setContactModal({ open: true, editing: null })}>
                  <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
                  <Text style={styles.addLinkText}>Add</Text>
                </TouchableOpacity>
              </View>
              {contactsData && contactsData.rows.length > 0 ? contactsData.rows.map((c) => (
                <View key={c.id} style={styles.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}{c.is_primary ? ' (Primary)' : ''}</Text>
                    <Text style={styles.contactMeta}>{[c.role, c.phone, c.email].filter(Boolean).join(' · ') || '—'}</Text>
                  </View>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setContactModal({ open: true, editing: c })}>
                    <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => confirmDeleteContact(c)}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )) : <Text style={styles.emptyHint}>No contacts yet.</Text>}
            </View>

            {canGovern ? (
              <View style={styles.governanceGroup}>
                {governanceActions.map((a) => (
                  <TouchableOpacity
                    key={a.target}
                    style={a.danger ? styles.dangerActionBtn : styles.actionBtn}
                    onPress={() => setStatusModal(a)}
                  >
                    <Ionicons name={a.icon} size={16} color={a.danger ? Colors.error : Colors.navy} />
                    <Text style={a.danger ? styles.dangerActionBtnText : styles.actionBtnText}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.deleteBtn, busy && { opacity: 0.6 }]} onPress={confirmDelete} disabled={busy}>
                  <Ionicons name="trash-outline" size={16} color={Colors.white} />
                  <Text style={styles.deleteBtnText}>Delete supplier</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}

        {activeTab === 'contracts' ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Contracts</Text>
              <TouchableOpacity style={styles.addLink} onPress={() => setContractModal({ open: true, editing: null })}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
                <Text style={styles.addLinkText}>Add</Text>
              </TouchableOpacity>
            </View>
            {contractsData && contractsData.rows.length > 0 ? contractsData.rows.map((c) => (
              <View key={c.id} style={[styles.contactRow, { flexWrap: 'wrap' }]}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={styles.contactName}>{c.contract_ref}{c.category ? ` · ${c.category}` : ''}</Text>
                  {c.start_date || c.end_date ? (
                    <Text style={styles.contactMeta}>{c.start_date ?? '—'} to {c.end_date ?? '—'}</Text>
                  ) : null}
                  {c.contract_value != null ? <Text style={styles.contactMeta}>Value: {Number(c.contract_value).toLocaleString()}</Text> : null}
                </View>
                <StatusBadge status={c.status} size="sm" withIcon />
                <TouchableOpacity style={styles.iconBtn} onPress={() => setContractModal({ open: true, editing: c })}>
                  <Ionicons name="create-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {canGovern && c.status === 'draft' ? (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setApproveReasonModal(c)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                  </TouchableOpacity>
                ) : null}
                {['active', 'expiring', 'expired'].includes(c.status) || (c.end_date && !['renewed', 'cancelled'].includes(c.status)) ? (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setRenewModal(c)}>
                    <Ionicons name="refresh-outline" size={16} color={Colors.navy} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )) : <Text style={styles.emptyHint}>No contracts yet.</Text>}
          </View>
        ) : null}

        {activeTab === 'compliance' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Compliance Checklist</Text>
            <View style={styles.divider} />
            {(complianceData?.rows ?? SRM_COMPLIANCE_TYPES.map((t) => ({ compliance_type: t, status: 'missing' } as SrmComplianceListItem))).map((c) => {
              const computed = c.computedStatus ?? c.status;
              return (
                <TouchableOpacity key={c.compliance_type} style={styles.contactRow} onPress={() => setComplianceModal(c)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.compliance_type}</Text>
                    <Text style={styles.contactMeta}>{c.expiry_date ? `Expires ${c.expiry_date}` : c.status === 'missing' ? 'No record on file' : '—'}</Text>
                  </View>
                  <View style={[styles.compliancePill, { backgroundColor: (COMPLIANCE_STATUS_COLOR[computed] ?? Colors.textMuted) + '22' }]}>
                    <Text style={[styles.compliancePillText, { color: COMPLIANCE_STATUS_COLOR[computed] ?? Colors.textMuted }]}>{computed}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {activeTab === 'documents' ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Documents</Text>
              <TouchableOpacity style={styles.addLink} onPress={() => setUploadModalOpen(true)}>
                <Ionicons name="cloud-upload-outline" size={16} color={Colors.navy} />
                <Text style={styles.addLinkText}>Upload</Text>
              </TouchableOpacity>
            </View>
            {documentsData && documentsData.rows.length > 0 ? documentsData.rows.map((d) => (
              <View key={d.id} style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName} numberOfLines={1}>{d.original_filename}</Text>
                  <Text style={styles.contactMeta}>{d.document_type} · v{d.version}{d.expiry_date ? ` · Expires ${d.expiry_date}` : ''}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => onDownloadDocument(d)}>
                  <Ionicons name="download-outline" size={16} color={Colors.navy} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => confirmDeleteDocument(d)}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )) : <Text style={styles.emptyHint}>No documents uploaded yet.</Text>}
          </View>
        ) : null}

        {activeTab === 'communications' ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Communications</Text>
              <TouchableOpacity style={styles.addLink} onPress={() => setCommModal({ open: true, editing: null })}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
                <Text style={styles.addLinkText}>Log</Text>
              </TouchableOpacity>
            </View>
            {communicationsData && communicationsData.rows.length > 0 ? communicationsData.rows.map((c) => (
              <TouchableOpacity key={c.id} style={styles.contactRow} onPress={() => setCommModal({ open: true, editing: c })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.communication_type}: {c.subject}</Text>
                  <Text style={styles.contactMeta}>{c.date}{c.next_action ? ` · Next: ${c.next_action}` : ''}</Text>
                </View>
              </TouchableOpacity>
            )) : <Text style={styles.emptyHint}>No communications logged yet.</Text>}
          </View>
        ) : null}

        {activeTab === 'improvements' ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Improvement Plans</Text>
              <TouchableOpacity style={styles.addLink} onPress={() => setPlanModal({ open: true, editing: null })}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.navy} />
                <Text style={styles.addLinkText}>New</Text>
              </TouchableOpacity>
            </View>
            {improvementPlansData && improvementPlansData.rows.length > 0 ? improvementPlansData.rows.map((p) => (
              <TouchableOpacity key={p.id} style={styles.contactRow} onPress={() => setPlanModal({ open: true, editing: p })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{p.title}</Text>
                  <Text style={styles.contactMeta}>{p.plan_type.replace('_', ' ')} · {p.status} · {p.completion_percent}%{p.due_date ? ` · Due ${p.due_date}` : ''}</Text>
                </View>
              </TouchableOpacity>
            )) : <Text style={styles.emptyHint}>No improvement plans yet.</Text>}
          </View>
        ) : null}

        {activeTab === 'intelligence' ? (
          intelData ? (
            <>
              <View style={styles.scoreCard}>
                <View style={[styles.scoreCircle, { borderColor: TIER_COLOR[intelData.supplier.tier] ?? Colors.textMuted }]}>
                  <Text style={[styles.scoreValue, { color: TIER_COLOR[intelData.supplier.tier] ?? Colors.textMuted }]}>{intelData.supplier.overallScore}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.tierPill, { backgroundColor: (TIER_COLOR[intelData.supplier.tier] ?? Colors.textMuted) + '22', alignSelf: 'flex-start', marginBottom: 6 }]}>
                    <Text style={[styles.tierPillText, { color: TIER_COLOR[intelData.supplier.tier] ?? Colors.textMuted }]}>{intelData.supplier.tier}</Text>
                  </View>
                  <SubScoreBar label="Delivery" value={intelData.supplier.scores.delivery} />
                  <SubScoreBar label="Quality" value={intelData.supplier.scores.quality} />
                  <SubScoreBar label="Cost" value={intelData.supplier.scores.cost} />
                  <SubScoreBar label="Compliance" value={intelData.supplier.scores.compliance} />
                  <SubScoreBar label="Responsiveness" value={intelData.supplier.scores.responsiveness} />
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statTile}><Text style={styles.statValue}>{intelData.supplier.totalPos}</Text><Text style={styles.statLabel}>Purchase Orders</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{Number(intelData.supplier.totalSpend).toLocaleString()}</Text><Text style={styles.statLabel}>Total Spend</Text></View>
                <View style={styles.statTile}><Text style={styles.statValue}>{intelData.supplier.rejectRatePct}%</Text><Text style={styles.statLabel}>Reject Rate</Text></View>
              </View>

              {intelData.supplier.riskIndicators.length > 0 ? (
                <View style={styles.riskCard}>
                  <Ionicons name="warning" size={16} color={Colors.error} />
                  <Text style={styles.riskCardText}>{intelData.supplier.riskIndicators.join(' · ')}</Text>
                </View>
              ) : null}
              <View style={styles.recCard}>
                <Ionicons name="bulb-outline" size={16} color={Colors.navy} />
                <Text style={styles.recCardText}>{intelData.supplier.recommendation}</Text>
              </View>

              {intelData.trend.length > 1 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Performance Trend (6 months)</Text>
                  <View style={styles.divider} />
                  <Text style={styles.trendLabel}>Spend</Text>
                  <SparklineChart data={intelData.trend.map((t) => t.spend)} width={260} height={30} color={Colors.navy} />
                  <Text style={[styles.trendLabel, { marginTop: Spacing.xs }]}>Reject Rate %</Text>
                  <SparklineChart data={intelData.trend.map((t) => t.rejectRatePct ?? 0)} width={260} height={30} color={Colors.error} />
                </View>
              ) : null}

              {intelData.purchaseHistory.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Purchase History</Text>
                  <View style={styles.divider} />
                  {intelData.purchaseHistory.slice(0, 10).map((h, i) => (
                    <View key={`${h.kind}-${h.id}`} style={[styles.historyRow, i > 0 && styles.rowDivider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyLabel}>{h.kind === 'purchase_order' ? 'PO' : h.kind === 'invoice' ? 'Invoice' : 'Goods Receipt'} {h.ref || '#' + h.id}</Text>
                        <Text style={styles.historyMeta}>{new Date(h.date).toLocaleDateString()} · {h.status}</Text>
                      </View>
                      {h.amount != null ? <Text style={styles.historyAmount}>{Number(h.amount).toLocaleString()}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {intelData.timeline.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Timeline</Text>
                  <View style={styles.divider} />
                  {intelData.timeline.slice(0, 10).map((t, i) => (
                    <View key={i} style={[styles.historyRow, i > 0 && styles.rowDivider]}>
                      <Text style={styles.timelineDate}>{new Date(t.date).toLocaleDateString()}</Text>
                      <Text style={styles.timelineLabel} numberOfLines={2}>{t.label}{t.reason ? ` — ${t.reason}` : ''}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : <Text style={styles.emptyHint}>Intelligence data not available yet.</Text>
        ) : null}
      </ScrollView>

      <StatusReasonModal
        visible={!!statusModal}
        title={statusModal?.label ?? ''}
        actionLabel={statusModal?.label ?? 'Confirm'}
        danger={statusModal?.danger}
        onClose={() => setStatusModal(null)}
        onConfirm={onStatusReason}
      />
      <StatusReasonModal
        visible={archiveFallbackOpen}
        title="Cannot Delete Supplier"
        actionLabel="Archive Instead"
        placeholder={deleteBlockedReason}
        onClose={() => setArchiveFallbackOpen(false)}
        onConfirm={onArchiveInstead}
      />
      <StatusReasonModal
        visible={!!approveReasonModal}
        title={`Approve ${approveReasonModal?.contract_ref ?? ''}`}
        actionLabel="Approve Contract"
        placeholder="Why is this contract being approved?"
        onClose={() => setApproveReasonModal(null)}
        onConfirm={onApproveContract}
      />
      <ContactFormModal
        visible={contactModal.open}
        initial={contactModal.editing}
        onClose={() => setContactModal({ open: false, editing: null })}
        onSave={onSaveContact}
      />
      <ContractFormModal
        visible={contractModal.open}
        initial={contractModal.editing}
        onClose={() => setContractModal({ open: false, editing: null })}
        onSave={onSaveContract}
      />
      <RenewContractModal
        visible={!!renewModal}
        contract={renewModal}
        onClose={() => setRenewModal(null)}
        onSave={onRenewContract}
      />
      <ComplianceFormModal
        visible={!!complianceModal}
        initial={complianceModal}
        canWaive={canGovern}
        onClose={() => setComplianceModal(null)}
        onSave={onSaveCompliance}
      />
      <DocumentUploadModal
        visible={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={onUploadDocument}
      />
      <CommunicationFormModal
        visible={commModal.open}
        initial={commModal.editing}
        onClose={() => setCommModal({ open: false, editing: null })}
        onSave={onSaveCommunication}
      />
      <ImprovementPlanFormModal
        visible={planModal.open}
        initial={planModal.editing}
        onClose={() => setPlanModal({ open: false, editing: null })}
        onSave={onSavePlan}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  tabBar: { backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  tabBarContent: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, gap: Spacing.xs },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  tabItemActive: { backgroundColor: Colors.navy },
  tabItemText: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textMuted },
  tabItemTextActive: { color: Colors.white },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  preferredPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fdf1e6', borderRadius: Radius.full, paddingVertical: 3, paddingHorizontal: Spacing.sm },
  preferredPillText: { fontSize: Typography.xs, color: Colors.orange, fontWeight: Typography.medium },
  blacklistBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm },
  blacklistBannerText: { color: Colors.error, fontSize: Typography.sm, fontWeight: Typography.medium },
  reasonBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  reasonBannerText: { color: Colors.textSecondary, fontSize: Typography.sm, flex: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statTile: { flex: 1, backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center' },
  statValue: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, marginTop: 2, textAlign: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: Colors.divider, marginTop: -Spacing.xs },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadow.sm },
  scoreCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: Typography.xl, fontWeight: Typography.bold },
  tierPill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  tierPillText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  riskCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.errorBg, borderRadius: Radius.md, padding: Spacing.sm },
  riskCardText: { flex: 1, fontSize: Typography.xs, color: Colors.error },
  recCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.navyBg, borderRadius: Radius.md, padding: Spacing.sm },
  recCardText: { flex: 1, fontSize: Typography.xs, color: Colors.navy },
  trendLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, gap: Spacing.sm },
  historyLabel: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  historyMeta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  historyAmount: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.semibold },
  timelineDate: { fontSize: Typography.xs, color: Colors.textMuted, width: 74 },
  timelineLabel: { flex: 1, fontSize: Typography.xs, color: Colors.textPrimary },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLinkText: { fontSize: Typography.sm, color: Colors.navy, fontWeight: Typography.medium },
  infoRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  infoLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  infoValue: { fontSize: Typography.sm, color: Colors.textPrimary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.divider },
  contactName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  contactMeta: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  emptyHint: { fontSize: Typography.sm, color: Colors.textMuted, fontStyle: 'italic' },
  iconBtn: { padding: Spacing.xs },
  compliancePill: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  compliancePillText: { fontSize: Typography.xs, fontWeight: Typography.semibold, textTransform: 'capitalize' },
  governanceGroup: { gap: Spacing.xs, marginTop: Spacing.xs },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.navy, borderRadius: Radius.md, padding: Spacing.sm },
  actionBtnText: { color: Colors.navy, fontSize: Typography.sm, fontWeight: Typography.medium },
  dangerActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, padding: Spacing.sm },
  dangerActionBtnText: { color: Colors.error, fontSize: Typography.sm, fontWeight: Typography.medium },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.error, borderRadius: Radius.md, padding: Spacing.sm },
  deleteBtnText: { color: Colors.white, fontSize: Typography.sm, fontWeight: Typography.semibold },
});

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.base, maxHeight: '85%', ...Shadow.lg,
  },
  title: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.bg },
  inputError: { borderColor: Colors.error },
  error: { fontSize: Typography.xs, color: Colors.error, marginTop: 4 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  saveText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  dangerBtn: { flex: 2, backgroundColor: Colors.error, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  dangerText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});

const pickerStyles = StyleSheet.create({
  picker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, backgroundColor: Colors.bg },
  pickerText: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
});
