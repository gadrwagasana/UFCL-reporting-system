import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView }       from 'react-native-safe-area-context';
import { StatusBar }          from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons }           from '@expo/vector-icons';
import { useQueryClient }     from '@tanstack/react-query';
import { AppHeader }          from '../../components/AppHeader';
import { FormSelect }         from '../../components/FormSelect';
import { useSalesOrdersList, useSalesOrderCreate, useSalesOrderUpdate } from '../../hooks/useSalesOrders';
import {
  PAYMENT_TERMS, PRODUCT_TYPES, TIMBER_SUB_TYPES, CURRENCIES, computeDueDate,
} from '../../utils/salesConstants';
import type { SalesOrdersStackParamList } from '../../navigation/types';
import { Colors, Spacing, Typography, Radius } from '../../theme';

type CreateProps = NativeStackScreenProps<SalesOrdersStackParamList, 'SalesOrderCreate'>;
type EditProps   = NativeStackScreenProps<SalesOrdersStackParamList, 'SalesOrderEdit'>;

export function SalesOrderFormScreen() {
  const navigation = useNavigation<CreateProps['navigation']>();
  const route      = useRoute<CreateProps['route'] | EditProps['route']>();
  const qc         = useQueryClient();

  const existing   = (route.params as any)?.order ?? null;
  const isEdit     = existing != null;

  const { data } = useSalesOrdersList();
  const createMutation = useSalesOrderCreate();
  const updateMutation = useSalesOrderUpdate();

  const customers = data?.dropdowns?.customers ?? [];
  const products  = data?.dropdowns?.products  ?? [];

  // Refresh dropdowns whenever the screen comes into focus (e.g. after creating a customer)
  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['sales-orders'] });
  }, [qc]));

  // Form state
  const [orderNumber,   setOrderNumber]   = useState(existing?.order_number    ?? '');
  const [customerId,    setCustomerId]    = useState(String(existing?.customer_id ?? ''));
  const [productType,   setProductType]   = useState(existing?.product_type     ?? '');
  const [productSubType,setProductSubType]= useState(existing?.product_sub_type ?? '');
  const [productSize,   setProductSize]   = useState(existing?.product_size     ?? '');
  const [manualSize,    setManualSize]    = useState('');
  const [useManualSize, setUseManualSize] = useState(false);
  const [quantity,      setQuantity]      = useState(String(existing?.quantity  ?? ''));
  const [currency,      setCurrency]      = useState(existing?.currency          ?? 'RWF');
  const [unitPrice,     setUnitPrice]     = useState(String(existing?.unit_price ?? ''));
  const [priceTaxType,  setPriceTaxType]  = useState(existing?.price_tax_type   ?? 'Exclusive');
  const [paymentTerm,   setPaymentTerm]   = useState<string>('Cash');
  const [customDueDate, setCustomDueDate] = useState(existing?.payment_due_date?.slice(0,10) ?? '');
  const [notes,         setNotes]         = useState(existing?.notes             ?? '');
  const [reason,        setReason]        = useState('');

  // Derived
  const custOptions = customers.map(c => ({
    label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}`,
    value: String(c.id),
  }));
  const selectedCustomer = customers.find(c => String(c.id) === customerId);

  const filteredProducts = products.filter(p => {
    if (!productType) return false;
    if (p.type !== productType) return false;
    if (productType === 'Timber' && productSubType && p.sub_type !== productSubType) return false;
    return true;
  });
  const sizeOptions = [
    ...filteredProducts.map(p => ({
      label: `${p.sub_type ? p.sub_type + ' — ' : ''}${p.size}`,
      value: p.size,
    })),
    { label: 'Other (enter manually)…', value: '__other__' },
  ];

  const computedDue = paymentTerm === 'Custom' ? customDueDate
    : computeDueDate(paymentTerm as any);

  const effectiveSize = useManualSize ? manualSize.trim() : productSize;
  const customerName  = selectedCustomer?.name ?? (existing?.customer_name ?? '');

  const canSubmit = orderNumber.trim()
    && (customerId || customerName)
    && productType
    && (productType !== 'Timber' || productSubType)
    && effectiveSize
    && Number(quantity) > 0
    && Number(unitPrice) >= 0
    && (isEdit || reason.trim())
    && !createMutation.isPending && !updateMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload: any = {
      order_number:     orderNumber.trim(),
      customer_id:      customerId ? Number(customerId) : undefined,
      customer_name:    customerName,
      product_type:     productType,
      product_sub_type: productType === 'Timber' ? productSubType || undefined : undefined,
      product_size:     effectiveSize,
      quantity:         Number(quantity),
      unit_price:       Number(unitPrice),
      currency,
      price_tax_type:   priceTaxType,
      payment_due_date: computedDue || undefined,
      notes:            notes.trim() || undefined,
    };
    if (!isEdit) payload.reason = reason.trim();

    try {
      if (isEdit) {
        const res = await updateMutation.mutateAsync({ id: existing.id, ...payload });
        if ((res as any).pendingApproval) {
          Alert.alert('Submitted', 'Change submitted for manager approval.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } else {
          navigation.goBack();
        }
      } else {
        await createMutation.mutateAsync(payload);
        Alert.alert('Success', 'Sales order created.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch {
      Alert.alert('Error', 'Failed to save order. Please try again.');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <AppHeader
        title={isEdit ? 'Edit Sales Order' : 'New Sales Order'}
        subtitle={isEdit ? existing.order_number : undefined}
        onBack={() => navigation.goBack()}
        dark
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Order number */}
          <View style={s.field}>
            <Text style={s.label}>Order Number <Text style={s.req}>*</Text></Text>
            <TextInput
              style={s.input}
              value={orderNumber}
              onChangeText={setOrderNumber}
              placeholder="SO-2026-XXX"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          {/* Customer */}
          <View style={s.field}>
            <View style={s.labelRow}>
              <Text style={s.label}>Customer <Text style={s.req}>*</Text></Text>
              <TouchableOpacity
                style={s.newBtn}
                onPress={() => navigation.navigate('SalesCustomerCreate')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={13} color={Colors.navy} />
                <Text style={s.newBtnText}>New</Text>
              </TouchableOpacity>
            </View>
            <FormSelect
              label=""
              options={custOptions}
              value={customerId}
              placeholder="Select customer…"
              onChange={v => setCustomerId(String(v))}
            />
          </View>

          {/* Product type */}
          <View style={s.field}>
            <FormSelect
              label="Product Category"
              options={PRODUCT_TYPES.map(t => ({ label: t === 'Poles' ? 'Wooden Poles' : t, value: t }))}
              value={productType}
              placeholder="Select category…"
              onChange={v => { setProductType(String(v)); setProductSize(''); setUseManualSize(false); }}
              required
            />
          </View>

          {/* Timber sub-type */}
          {productType === 'Timber' && (
            <View style={s.field}>
              <FormSelect
                label="Timber Type"
                options={TIMBER_SUB_TYPES.map(t => ({ label: t, value: t }))}
                value={productSubType}
                placeholder="Select type…"
                onChange={v => { setProductSubType(String(v)); setProductSize(''); setUseManualSize(false); }}
                required
              />
            </View>
          )}

          {/* Size / spec */}
          {productType && (productType !== 'Timber' || productSubType) && (
            <View style={s.field}>
              {!useManualSize ? (
                <FormSelect
                  label="Size / Spec"
                  options={sizeOptions}
                  value={productSize}
                  placeholder="Select size…"
                  onChange={v => {
                    if (String(v) === '__other__') { setUseManualSize(true); setProductSize(''); }
                    else {
                      setProductSize(String(v));
                      // Sawmill Phase 2 — prefill the negotiated price from
                      // the catalog's Default Selling Price; still editable,
                      // and never written back to the Product Catalog (see
                      // salesCreate — this order's unit_price is its own field).
                      const matched = filteredProducts.find(p => p.size === String(v));
                      if (matched?.default_price != null) setUnitPrice(String(matched.default_price));
                    }
                  }}
                  required
                />
              ) : (
                <>
                  <Text style={s.label}>Size / Spec <Text style={s.req}>*</Text></Text>
                  <TextInput
                    style={s.input}
                    value={manualSize}
                    onChangeText={setManualSize}
                    placeholder="e.g. 50x100x4m"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => { setUseManualSize(false); setManualSize(''); }}>
                    <Text style={s.linkText}>← Back to catalog</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Quantity */}
          <View style={s.field}>
            <Text style={s.label}>Quantity <Text style={s.req}>*</Text></Text>
            <TextInput
              style={s.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Currency + Unit price + Tax type */}
          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <FormSelect
                label="Currency"
                options={CURRENCIES.map(c => ({ label: c, value: c }))}
                value={currency}
                onChange={v => setCurrency(String(v))}
              />
            </View>
            <View style={[s.field, { flex: 2 }]}>
              <Text style={s.label}>Unit Price <Text style={s.req}>*</Text></Text>
              <TextInput
                style={s.input}
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
          <View style={s.field}>
            <FormSelect
              label="Unit Price Includes"
              options={[
                { label: 'Without transport (Ex-works)', value: 'Exclusive' },
                { label: 'With transport (Delivered)',   value: 'Inclusive' },
              ]}
              value={priceTaxType}
              onChange={v => setPriceTaxType(String(v))}
            />
          </View>

          {/* Payment terms */}
          <View style={s.field}>
            <FormSelect
              label="Payment Terms"
              options={PAYMENT_TERMS.map(t => ({ label: t, value: t }))}
              value={paymentTerm}
              onChange={v => setPaymentTerm(String(v))}
            />
            {paymentTerm === 'Custom' && (
              <>
                <Text style={[s.label, { marginTop: Spacing.sm }]}>Payment Due Date <Text style={s.req}>*</Text></Text>
                <TextInput
                  style={s.input}
                  value={customDueDate}
                  onChangeText={setCustomDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}
            {computedDue && paymentTerm !== 'Custom' && (
              <Text style={s.hint}>Due date: {new Date(computedDue).toLocaleDateString('en-GB')}</Text>
            )}
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.label}>Notes <Text style={s.opt}>(optional)</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Delivery instructions or special notes…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Reason — required on create only */}
          {!isEdit && (
            <View style={s.field}>
              <Text style={s.label}>Reason / Description <Text style={s.req}>*</Text></Text>
              <TextInput
                style={s.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Required for audit trail"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || isPending}
            activeOpacity={0.8}
          >
            {isPending
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitText}>{isEdit ? 'Save Changes' : 'Create Sales Order'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  row:   { flexDirection: 'row', gap: Spacing.sm },
  field: { gap: 6 },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  req:   { color: Colors.error },
  opt:   { fontWeight: '400', color: Colors.textMuted },
  hint:  { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  linkText: { fontSize: Typography.xs, color: Colors.navy, marginTop: 4 },

  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  newBtnText:{ fontSize: Typography.xs, color: Colors.navy, fontWeight: Typography.medium },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: Typography.sm, color: Colors.textPrimary, backgroundColor: Colors.card,
  },
  textArea: { minHeight: 72 },

  submitBtn: {
    backgroundColor: Colors.navy, borderRadius: Radius.md,
    paddingVertical: Spacing.base, alignItems: 'center', marginTop: Spacing.sm,
  },
  submitText:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  btnDisabled: { opacity: 0.4 },
});
