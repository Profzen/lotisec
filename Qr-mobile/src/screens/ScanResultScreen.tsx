/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts, fontSizes } from '../theme/typography';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { api } from '../api/config';

export default function ScanResultScreen({ route, navigation }: any) {
  const { profileId } = route.params;

  const [unlockedData, setUnlockedData] = useState<any>(null);
  const [verifying,    setVerifying]    = useState(false);

  const handleUnlock = async () => {
    setVerifying(true);
    try {
      const data = await api('/scan/verify', 'POST', { token:profileId,pin:'',authority_type:'emergency_unit' });
      setUnlockedData(data);
    } catch (e: any) {
      Alert.alert("Accès refusé", e?.message || "Un compte professionnel autorisé est requis.");
    } finally {
      setVerifying(false);
    }
  };

  // ── VUE VERROUILLÉE ──────────────────────────────────────────
  if (!unlockedData) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="shield-half" size={70} color={colors.primary} />
          <Text style={styles.headerTitle}>118</Text>
          <Text style={styles.headerSub}>Fiche d'urgence scannée</Text>
        </View>

        <View style={styles.alertBanner}>
          <Text style={styles.alertText}><FontAwesome name="warning" size={14} /> En cas d'urgence, appelez le 118</Text>
        </View>

        <View style={styles.lockBox}>
          <Text style={styles.lockTitle}><FontAwesome name="shield" size={24} /> Accès Médical Sécurisé</Text>
          <Text style={styles.lockSubtitle}>
            Connectez-vous avec un compte professionnel autorisé pour accéder aux données vitales complètes.
          </Text>

          <TouchableOpacity
            style={[styles.btn, verifying && styles.btnDisabled]}
            onPress={handleUnlock}
            disabled={verifying}
          >
            {verifying
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Ouvrir la fiche sécurisée</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── VUE DÉVERROUILLÉE ─────────────────────────────────────────
  const { identity, medical, vehicle, emergency_contacts, audit } = unlockedData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0f172a' }]}>
        <Ionicons name="medical" size={50} color="#e11d48" />
        <Text style={styles.headerTitle}>Données vitales</Text>
        <View style={styles.authorityBadge}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="shield-checkmark" size={16} color={colors.success}/><Text style={styles.authorityText}>{audit?.authority || 'Professionnel'}</Text></View>
        </View>
      </View>

      {/* Identité */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>👤 IDENTITÉ</Text>
        <Text style={styles.name}>
          {identity?.first_name} {identity?.last_name}
        </Text>
        <Text style={styles.meta}>
          {identity?.gender} • Né(e) le {identity?.birth_date} • {identity?.nationality}
        </Text>
      </View>

      {/* Médical */}
      <View style={[styles.section, styles.vitalSection]}>
        <Text style={styles.sectionLabel}>🏥 DONNÉES MÉDICALES </Text>

        <View style={styles.bloodBadge}>
          <Text style={styles.bloodLabel}>GROUPE SANGUIN</Text>
          <Text style={styles.bloodValue}>{medical?.blood_type || 'NC'}</Text>
        </View>

        {medical?.allergies && medical.allergies !== 'Aucune' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Allergies</Text>
            <Text style={[styles.infoValue, { color: '#e11d48' }]}>{medical.allergies}</Text>
          </View>
        )}
        {medical?.conditions && medical.conditions !== 'Aucune' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Maladies chroniques</Text>
            <Text style={styles.infoValue}>{medical.conditions}</Text>
          </View>
        )}
        {medical?.medications && medical.medications !== 'Aucun' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Médicaments</Text>
            <Text style={styles.infoValue}>{medical.medications}</Text>
          </View>
        )}
        {medical?.disabilities && medical.disabilities !== 'Aucun' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Handicap</Text>
            <Text style={styles.infoValue}>{medical.disabilities}</Text>
          </View>
        )}
      </View>

      {/* Contacts d'urgence */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}><FontAwesome name="phone" size={16} /> CONTACTS D'URGENCE</Text>
        {emergency_contacts && emergency_contacts.length > 0
          ? emergency_contacts.map((c: any, i: number) => (
            <View key={i} style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {c.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactRelation}>{c.relation || 'Contact'} • {c.phone}</Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${c.phone}`)}
              >
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ))
          : <Text style={styles.noData}>Aucun contact renseigné</Text>
        }
      </View>

      {/* Véhicule */}
      {vehicle?.has_vehicle && (
        <View style={styles.section}>
          <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Ionicons name="car-outline" size={18} color={colors.primary}/><Text style={styles.sectionLabel}>VÉHICULE</Text></View>
          {vehicle.type && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{vehicle.type}</Text>
            </View>
          )}
          {vehicle.plate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Immatriculation</Text>
              <Text style={[styles.infoValue, { fontWeight: '800' }]}>{vehicle.plate}</Text>
            </View>
          )}
          {(vehicle.brand || vehicle.model) && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Marque / Modèle</Text>
              <Text style={styles.infoValue}>{`${vehicle.brand || ''} ${vehicle.model || ''}`.trim()}</Text>
            </View>
          )}
        </View>
      )}

      {/* Audit */}
      <Text style={styles.auditLog}>
        Session sécurisée • Unité {audit?.authority} • Token {audit?.token}
      </Text>

      {/* Bouton quitter */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>Quitter le profil</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f1f5f9' },
  content:          { padding: 20, paddingBottom: 40 },

  header: {
    alignItems: 'center', marginTop: 10,
    marginBottom: 20, backgroundColor: colors.primary,
    marginHorizontal: -20, paddingVertical: 30,
  },
  headerTitle:      { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 8 },
  headerSub:        { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  authorityBadge:   { backgroundColor: '#4ade80', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 4, marginTop: 10 },
  authorityText:    { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  alertBanner: {
    backgroundColor: '#fee2e2', borderWidth: 1,
    borderColor: '#fca5a5', borderRadius: 12,
    padding: 12, marginBottom: 16, alignItems: 'center',
  },
  alertText:        { color: '#dc2626', fontWeight: '700', fontSize: 14 },

  lockBox: {
    backgroundColor: '#fff', padding: 24,
    borderRadius: 20, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  },
  lockTitle:        { fontSize: 18, fontWeight: '800', textAlign: 'center', color: '#0f172a', marginBottom: 8 },
  lockSubtitle:     { textAlign: 'center', color: '#64748b', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  input: {
    backgroundColor: '#f8fafc', borderRadius: 12,
    padding: 16, fontSize: 22, textAlign: 'center',
    fontWeight: '800', marginBottom: 16,
    borderWidth: 1.5, borderColor: '#e2e8f0', color: '#0f172a',
    letterSpacing: 3,
  },
  btn:              { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
  btnDisabled:      { opacity: 0.5 },
  btnText:          { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 1 },

  section: {
    backgroundColor: '#fff', padding: 18,
    borderRadius: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  vitalSection:     { borderLeftWidth: 5, borderLeftColor: '#e11d48' },
  sectionLabel:     { fontSize: 11, color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  name:             { fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  meta:             { fontSize: 13, color: '#64748b' },

  bloodBadge: {
    backgroundColor: '#fff1f2', alignSelf: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, alignItems: 'center', marginBottom: 14,
    borderWidth: 1.5, borderColor: '#fca5a5',
  },
  bloodLabel:       { fontSize: 10, color: '#e11d48', fontWeight: '900', letterSpacing: 1 },
  bloodValue:       { fontSize: 38, fontWeight: '900', color: '#e11d48', lineHeight: 44 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  infoLabel:        { fontSize: 13, color: '#64748b', flex: 1 },
  infoValue:        { fontSize: 13, fontWeight: '700', color: '#0f172a', flex: 2, textAlign: 'right' },

  contactRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  contactAvatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText:{ fontSize: 16, fontWeight: '800', color: '#fff' },
  contactName:      { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  contactRelation:  { fontSize: 12, color: '#64748b', marginTop: 2 },
  callBtn:          { backgroundColor: '#059669', padding: 10, borderRadius: 10 },
  noData:           { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },

  auditLog:         { textAlign: 'center', fontSize: 11, color: '#94a3b8', marginVertical: 16, fontStyle: 'italic' },
  closeBtn:         { backgroundColor: '#334155', padding: 16, borderRadius: 14, alignItems: 'center' },
  closeBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
});
