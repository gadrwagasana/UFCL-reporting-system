import React, { useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, BackHandler,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  UpdateMeta, UpdateError, UpdateErrorKind,
  ignoreVersion, saveResumeState, loadResumeState, clearResumeState,
  verifyMd5, APK_CACHE,
} from '../services/updateChecker';
import { Colors } from '../theme';

interface Props {
  meta:      UpdateMeta;
  onDismiss: () => void;
}

type Phase = 'prompt' | 'downloading' | 'verifying' | 'installing' | 'error';

// User-facing messages for each error category
const ERROR_MESSAGES: Record<UpdateErrorKind, string> = {
  network:  'Cannot reach the update server.\nCheck your Wi-Fi or VPN connection and try again.',
  server:   'The update server returned an error.\nPlease contact IT if this persists.',
  checksum: 'File integrity check failed — the downloaded file may be corrupt.\nPlease retry.',
  install:  'Could not open the Android installer.\nGo to Settings → Apps → UFCL Mobile and grant "Install unknown apps".',
  storage:  'Not enough storage space on this device.\nFree up space and try again.',
  unknown:  'An unexpected error occurred.\nPlease retry or contact IT support.',
};

export function UpdateModal({ meta, onDismiss }: Props) {
  const [phase,    setPhase]    = useState<Phase>('prompt');
  const [progress, setProgress] = useState(0);
  const [errKind,  setErrKind]  = useState<UpdateErrorKind>('unknown');
  const [errDetail, setErrDetail] = useState('');

  // Keep a ref to the active DownloadResumable so we can pause it if needed
  const dlRef = useRef<FileSystem.DownloadResumable | null>(null);

  // ── Error helper ──────────────────────────────────────────────────────────
  const showError = useCallback((e: unknown) => {
    if (e instanceof UpdateError) {
      setErrKind(e.kind);
      setErrDetail(e.message);
    } else {
      setErrKind('unknown');
      setErrDetail((e as any)?.message ?? 'Unknown error');
    }
    setPhase('error');
  }, []);

  // ── Download + Verify + Install ───────────────────────────────────────────
  const handleUpdateNow = useCallback(async () => {
    setPhase('downloading');
    setProgress(0);

    try {
      // Progress callback
      const onProgress = ({ totalBytesWritten, totalBytesExpectedToWrite }:
        FileSystem.DownloadProgressData) => {
        if (totalBytesExpectedToWrite > 0) {
          setProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
        }
      };

      // Try to resume an interrupted download first
      const saved = await loadResumeState();
      let result: FileSystem.FileSystemDownloadResult | undefined;

      if (saved && saved.url === meta.apkUrl) {
        // Resume from where we left off
        const dl = new FileSystem.DownloadResumable(
          saved.url,
          saved.fileUri,
          saved.options,
          onProgress,
          saved.resumeData,
        );
        dlRef.current = dl;
        result = await dl.resumeAsync() ?? undefined;
      }

      if (!result) {
        // Fresh download (no saved state, or resume returned nothing)
        const info = await FileSystem.getInfoAsync(APK_CACHE);
        if (info.exists) await FileSystem.deleteAsync(APK_CACHE, { idempotent: true });

        const dl = FileSystem.createDownloadResumable(
          meta.apkUrl,
          APK_CACHE,
          {},
          onProgress,
        );
        dlRef.current = dl;

        // Save resumable state immediately so a crash mid-download is resumable
        const state = dl.savable();
        await saveResumeState(state);

        result = await dl.downloadAsync() ?? undefined;
      }

      if (!result?.uri) {
        throw new UpdateError('network', 'Download failed — no file received. Please retry.');
      }

      // MD5 verification
      setPhase('verifying');
      if (meta.md5) {
        await verifyMd5(result.uri, meta.md5);
      }

      // Clear saved state — download is complete and verified
      await clearResumeState();

      // Hand off to Android installer
      setPhase('installing');
      try {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        await Linking.openURL(contentUri);
      } catch {
        throw new UpdateError(
          'install',
          ERROR_MESSAGES.install,
        );
      }

      onDismiss();
    } catch (e) {
      showError(e);
    }
  }, [meta.apkUrl, meta.md5, onDismiss, showError]);

  // ── Later (non-mandatory only) ────────────────────────────────────────────
  const handleLater = useCallback(async () => {
    await ignoreVersion(meta.versionCode);
    onDismiss();
  }, [meta.versionCode, onDismiss]);

  // ── Retry ────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setPhase('prompt');
  }, []);

  // ── Back-button guard for mandatory updates ────────────────────────────────
  // Android back button is disabled when the update is mandatory so users
  // cannot dismiss the dialog without updating.
  const onRequestClose = useCallback(() => {
    if (meta.mandatory) return; // block
    onDismiss();
  }, [meta.mandatory, onDismiss]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isActive = phase === 'downloading' || phase === 'verifying' || phase === 'installing';

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.icon}>↑</Text>
            <Text style={s.title}>UFCL Mobile Update Available</Text>
          </View>

          {/* Version + mandatory badge */}
          <View style={s.versionRow}>
            <Text style={s.versionLabel}>Version</Text>
            <View style={s.versionBadge}>
              <Text style={s.versionText}>{meta.version}</Text>
            </View>
            {meta.mandatory && (
              <View style={s.mandatoryBadge}>
                <Text style={s.mandatoryText}>Required — update to continue</Text>
              </View>
            )}
          </View>

          {/* Release notes */}
          {meta.notes.length > 0 && phase !== 'error' && (
            <View style={s.notes}>
              <Text style={s.notesHeader}>What's New</Text>
              {meta.notes.map((note, i) => (
                <Text key={i} style={s.note}>• {note}</Text>
              ))}
            </View>
          )}

          {/* ── Phase: prompt ── */}
          {phase === 'prompt' && (
            <View style={s.actions}>
              <TouchableOpacity style={s.btnPrimary} onPress={handleUpdateNow} activeOpacity={0.8}>
                <Text style={s.btnPrimaryText}>Update Now</Text>
              </TouchableOpacity>
              {!meta.mandatory && (
                <TouchableOpacity style={s.btnSecondary} onPress={handleLater} activeOpacity={0.7}>
                  <Text style={s.btnSecondaryText}>Later</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Phase: downloading ── */}
          {phase === 'downloading' && (
            <View style={s.progressWrap}>
              <Text style={s.progressLabel}>Downloading…  {progress}%</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progress}%` as any }]} />
              </View>
              <Text style={s.progressHint}>
                {progress < 100 ? 'Stay connected to Wi-Fi' : 'Finalising…'}
              </Text>
            </View>
          )}

          {/* ── Phase: verifying ── */}
          {phase === 'verifying' && (
            <View style={s.progressWrap}>
              <ActivityIndicator color={Colors.navy} />
              <Text style={s.progressLabel}>Verifying file integrity…</Text>
            </View>
          )}

          {/* ── Phase: installing ── */}
          {phase === 'installing' && (
            <View style={s.progressWrap}>
              <ActivityIndicator color={Colors.navy} />
              <Text style={s.progressLabel}>Opening installer…</Text>
              <Text style={s.progressHint}>Follow the on-screen prompts to complete installation.</Text>
            </View>
          )}

          {/* ── Phase: error ── */}
          {phase === 'error' && (
            <View style={s.errorWrap}>
              <View style={s.errorBox}>
                <Text style={s.errorTitle}>
                  {errKind === 'checksum' ? 'Integrity Check Failed'
                   : errKind === 'network'  ? 'Connection Problem'
                   : errKind === 'install'  ? 'Installation Blocked'
                   : errKind === 'storage'  ? 'Storage Full'
                   : 'Update Failed'}
                </Text>
                <Text style={s.errorMsg}>{ERROR_MESSAGES[errKind]}</Text>
                {errKind === 'checksum' && (
                  <Text style={s.errorDetail}>
                    Contact IT if the problem persists — a new APK may need to be deployed.
                  </Text>
                )}
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.btnPrimary} onPress={handleRetry} activeOpacity={0.8}>
                  <Text style={s.btnPrimaryText}>Retry</Text>
                </TouchableOpacity>
                {!meta.mandatory && (
                  <TouchableOpacity style={s.btnSecondary} onPress={handleLater} activeOpacity={0.7}>
                    <Text style={s.btnSecondaryText}>Later</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const NAVY = '#1a3c5e';

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  icon:           { fontSize: 22, color: NAVY, fontWeight: '700' },
  title:          { flex: 1, fontSize: 15, fontWeight: '700', color: NAVY, lineHeight: 20 },
  versionRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  versionLabel:   { fontSize: 13, color: '#666' },
  versionBadge:   { backgroundColor: '#e8f0fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  versionText:    { fontSize: 13, fontWeight: '700', color: NAVY },
  mandatoryBadge: { backgroundColor: '#fde8e8', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  mandatoryText:  { fontSize: 11, fontWeight: '700', color: '#c00' },
  notes:          { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 18 },
  notesHeader:    { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  note:           { fontSize: 13, color: '#444', lineHeight: 20 },
  actions:        { gap: 10, marginTop: 4 },
  btnPrimary:     { backgroundColor: NAVY, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary:   { borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  btnSecondaryText: { color: '#666', fontSize: 14 },
  progressWrap:   { alignItems: 'center', paddingVertical: 8, gap: 10 },
  progressLabel:  { fontSize: 14, color: '#333', fontWeight: '600' },
  progressHint:   { fontSize: 12, color: '#888', textAlign: 'center' },
  progressTrack:  { width: '100%', height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: NAVY, borderRadius: 4 },
  errorWrap:      { gap: 12 },
  errorBox:       { backgroundColor: '#fff5f5', borderRadius: 8, padding: 14, borderLeftWidth: 3, borderLeftColor: '#c00' },
  errorTitle:     { fontSize: 14, fontWeight: '700', color: '#900', marginBottom: 6 },
  errorMsg:       { fontSize: 13, color: '#555', lineHeight: 19 },
  errorDetail:    { fontSize: 11, color: '#888', marginTop: 8, fontStyle: 'italic' },
});
