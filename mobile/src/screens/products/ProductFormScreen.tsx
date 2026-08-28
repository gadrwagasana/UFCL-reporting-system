import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader }  from '../../components/AppHeader';
import { FormInput }  from '../../components/FormInput';
import { FormSelect } from '../../components/FormSelect';
import { useProductCreate, useProductUpdate } from '../../hooks/useProducts';
import { useOfflineStore } from '../../stores/offlineStore';
import { ProductsStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';

type NavProp    = NativeStackNavigationProp<ProductsStackParamList, 'ProductForm'>;
type RoutePropT = RouteProp<ProductsStackParamList, 'ProductForm'>;

// Auto-generate the size string from dimension inputs — mirrors desktop logic.
// Nyanza Value-Added Production Completion Phase — "Manufactured Product"
// doesn't fit either dimension model (pallets/crates etc. don't have a
// width/height/length or diameter/length spec the same way timber/poles
// do), so its size is free text instead of auto-generated — handled by the
// caller (manualSize state below), not this function.
function buildSize(
  type: string, w: string, h: string, l: string, d: string,
): string {
  if (type === 'Timber') {
    const wn = parseFloat(w), hn = parseFloat(h), ln = parseFloat(l);
    if (!isNaN(wn) && !isNaN(hn) && !isNaN(ln) && wn > 0 && hn > 0 && ln > 0)
      return `${wn}x${hn}x${ln}m`;
  } else if (type === 'Poles') {
    const dn = parseFloat(d), ln = parseFloat(l);
    if (!isNaN(dn) && !isNaN(ln) && dn > 0 && ln > 0)
      return `O${dn}x${ln}m`;
  }
  return '';
}

const TYPE_OPTIONS = [
  { label: 'Timber', value: 'Timber' },
  { label: 'Poles', value: 'Poles' },
  { label: 'Manufactured Product', value: 'Manufactured Product' },
];
const SUBTYPE_OPTIONS = [
  { label: 'Kiln-dried',  value: 'Kiln-dried' },
  { label: 'CCA-treated', value: 'CCA-treated' },
  { label: 'Untreated',   value: 'Untreated' },
];

export function ProductFormScreen() {
  const navigation = useNavigation<NavProp>();
  const route      = useRoute<RoutePropT>();
  const existing   = route.params?.product;
  const isEdit     = existing != null;

  const { createProduct } = useProductCreate();
  const { updateProduct } = useProductUpdate();
  const { isOnline }      = useOfflineStore();

  const [type,       setType]       = useState(existing?.type        ?? 'Timber');
  const [subType,    setSubType]    = useState(existing?.sub_type    ?? '');
  const [widthMm,    setWidthMm]    = useState(existing?.width_mm    != null ? String(existing.width_mm)    : '');
  const [heightMm,   setHeightMm]   = useState(existing?.height_mm   != null ? String(existing.height_mm)   : '');
  const [lengthM,    setLengthM]    = useState(existing?.length_m    != null ? String(existing.length_m)    : '');
  const [diameterMm, setDiameterMm] = useState(existing?.diameter_mm != null ? String(existing.diameter_mm) : '');
  const [manualSize, setManualSize] = useState(existing?.type === 'Manufactured Product' ? existing.size : '');
  const [machine,    setMachine]    = useState(existing?.machine      ?? '');
  const [ref,        setRef]        = useState(existing?.ref          ?? '');
  const [standardCost, setStandardCost] = useState(existing?.standard_cost != null ? String(existing.standard_cost) : '');
  const [defaultPrice, setDefaultPrice] = useState(existing?.default_price != null ? String(existing.default_price) : '');
  const [costApprover, setCostApprover] = useState(existing?.standard_cost_approved_by ?? '');
  const [costEffectiveDate, setCostEffectiveDate] = useState('');
  const [priceApprover, setPriceApprover] = useState(existing?.default_price_approved_by ?? '');
  const [priceEffectiveDate, setPriceEffectiveDate] = useState('');
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Size preview — auto-generated, matches desktop dimension-preview logic.
  // Manufactured Product has no dimension model, so its size is free text.
  const sizePreview = type === 'Manufactured Product' ? manualSize.trim() : buildSize(type, widthMm, heightMm, lengthM, diameterMm);

  // Reset sub_type when switching away from Timber
  useEffect(() => {
    if (type !== 'Timber') setSubType('');
  }, [type]);

  async function handleSubmit() {
    if (!isOnline) {
      Alert.alert('Online Required', 'Product management requires an active connection.');
      return;
    }
    if (type === 'Timber' && !subType) {
      Alert.alert('Required', 'Timber type (Kiln-dried / CCA-treated / Untreated) is required.'); return;
    }
    if (!sizePreview) {
      if (type === 'Timber')
        Alert.alert('Required', 'Width, height, and length are required to calculate the size.');
      else if (type === 'Poles')
        Alert.alert('Required', 'Diameter and length are required to calculate the size.');
      else
        Alert.alert('Required', 'Enter a product size / spec.');
      return;
    }
    if (!(Number(standardCost) > 0)) {
      Alert.alert('Required', 'Standard cost is required and must be greater than zero.'); return;
    }
    if (!costApprover.trim()) {
      Alert.alert('Required', 'A Finance approver name is required for Standard Cost.'); return;
    }
    if (!costEffectiveDate.trim()) {
      Alert.alert('Required', 'An effective date (YYYY-MM-DD) is required for Standard Cost.'); return;
    }
    if (!(Number(defaultPrice) > 0)) {
      Alert.alert('Required', 'Default selling price is required and must be greater than zero.'); return;
    }
    if (!priceApprover.trim()) {
      Alert.alert('Required', 'A Management approver name is required for Default Selling Price.'); return;
    }
    if (!priceEffectiveDate.trim()) {
      Alert.alert('Required', 'An effective date (YYYY-MM-DD) is required for Default Selling Price.'); return;
    }
    if (!isEdit && !reason.trim()) {
      Alert.alert('Required', 'A reason is required for the audit trail.'); return;
    }

    const payload = {
      type,
      ...(subType    && { sub_type:    subType }),
      size:           sizePreview,
      ...(widthMm    && { width_mm:    Number(widthMm) }),
      ...(heightMm   && { height_mm:   Number(heightMm) }),
      ...(lengthM    && { length_m:    Number(lengthM) }),
      ...(diameterMm && { diameter_mm: Number(diameterMm) }),
      ...(machine.trim() && { machine: machine.trim() }),
      ...(ref.trim()     && { ref:     ref.trim() }),
      standard_cost:  Number(standardCost),
      default_price:  Number(defaultPrice),
      standard_cost_approved_by:    costApprover.trim(),
      standard_cost_effective_date: costEffectiveDate.trim(),
      default_price_approved_by:    priceApprover.trim(),
      default_price_effective_date: priceEffectiveDate.trim(),
      ...(!isEdit        && { reason:  reason.trim() }),
    };

    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateProduct(existing.id, payload);
      } else {
        await createProduct(payload as any);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save product.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Product' : 'Add Product'}
        dark
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>

          <FormSelect
            label="Type"
            value={type}
            onChange={(v) => setType(v as unknown as 'Timber' | 'Poles' | 'Manufactured Product')}
            options={TYPE_OPTIONS}
            required
          />

          {type === 'Timber' && (
            <FormSelect
              label="Timber Type"
              value={subType}
              onChange={(v) => setSubType(String(v))}
              options={[{ label: '— Select type —', value: '' }, ...SUBTYPE_OPTIONS]}
              required
            />
          )}
        </View>

        {/* Timber dimensions */}
        {type === 'Timber' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dimensions</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <FormInput label="Width (mm)" value={widthMm} onChangeText={setWidthMm}
                  placeholder="e.g. 100" keyboardType="numeric" required />
              </View>
              <View style={styles.col}>
                <FormInput label="Height (mm)" value={heightMm} onChangeText={setHeightMm}
                  placeholder="e.g. 200" keyboardType="numeric" required />
              </View>
            </View>
            <FormInput label="Length (m)" value={lengthM} onChangeText={setLengthM}
              placeholder="e.g. 4" keyboardType="decimal-pad" required />
          </View>
        )}

        {/* Poles dimensions */}
        {type === 'Poles' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dimensions</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <FormInput label="Diameter (mm)" value={diameterMm} onChangeText={setDiameterMm}
                  placeholder="e.g. 255" keyboardType="numeric" required />
              </View>
              <View style={styles.col}>
                <FormInput label="Length (m)" value={lengthM} onChangeText={setLengthM}
                  placeholder="e.g. 9" keyboardType="decimal-pad" required />
              </View>
            </View>
          </View>
        )}

        {/* Manufactured Product — free-text size, no dimension model */}
        {type === 'Manufactured Product' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Size / Spec</Text>
            <FormInput label="Size / Spec" value={manualSize} onChangeText={setManualSize}
              placeholder="e.g. Standard Pallet 1.2x1.0m" required />
          </View>
        )}

        {/* Size preview */}
        {sizePreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Size Preview</Text>
            <Text style={styles.previewValue}>{sizePreview}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enterprise Costing</Text>
          <FormInput label="Standard Cost (RWF/piece)" value={standardCost} onChangeText={setStandardCost}
            placeholder="Amount" keyboardType="numeric" required />
          <FormInput label="Finance Approver" value={costApprover} onChangeText={setCostApprover}
            placeholder="Name of Finance approver" required />
          <FormInput label="Cost Effective Date" value={costEffectiveDate} onChangeText={setCostEffectiveDate}
            placeholder="YYYY-MM-DD" required />
          <FormInput label="Default Selling Price (RWF/piece)" value={defaultPrice} onChangeText={setDefaultPrice}
            placeholder="Amount" keyboardType="numeric" required />
          <FormInput label="Management Approver" value={priceApprover} onChangeText={setPriceApprover}
            placeholder="Name of Management approver" required />
          <FormInput label="Price Effective Date" value={priceEffectiveDate} onChangeText={setPriceEffectiveDate}
            placeholder="YYYY-MM-DD" required />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional Details</Text>
          <FormInput label="Machine" value={machine} onChangeText={setMachine} placeholder="Assigned machine name" />
          <FormInput label="Customer Reference" value={ref} onChangeText={setRef} placeholder="e.g. SO-1234" />
        </View>

        {!isEdit && (
          <View style={styles.section}>
            <FormInput
              label="Reason"
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this product being added?"
              multiline
              numberOfLines={2}
              required
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !isOnline) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !isOnline}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>{isEdit ? 'Save Changes' : 'Add Product'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  section: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.sm, ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  col: { flex: 1 },

  previewBox: {
    backgroundColor: Colors.navyBg, borderRadius: Radius.lg,
    padding: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  previewLabel: { fontSize: Typography.xs, color: Colors.navy, textTransform: 'uppercase', letterSpacing: 0.6 },
  previewValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.navy, fontFamily: 'monospace', marginTop: 4 },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.lg,
    paddingVertical: Spacing.base, alignItems: 'center', ...Shadow.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
});
