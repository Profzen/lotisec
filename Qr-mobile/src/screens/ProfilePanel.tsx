import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar,
  Switch, Alert, TextInput,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ProfilePanelProps {
  isDark:          boolean;
  onClose:         () => void;
  onToggleTheme:   (val: boolean) => void;
}

type ActiveSection = null | 'password' | 'notifications';

export default function ProfilePanel({
  isDark,
  onClose,
  onToggleTheme,
}: ProfilePanelProps) {

  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  // Changement mot de passe
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [pwdError,    setPwdError]    = useState<string | null>(null);
  const [pwdSuccess,  setPwdSuccess]  = useState<string | null>(null);

  // Notifications
  const [notifSMS,      setNotifSMS]      = useState(true);
  const [notifWhatsApp, setNotifWhatsApp] = useState(true);
  const [notifScan,     setNotifScan]     = useState(true);

  // Palette
  const th = {
    bg:      isDark ? '#0D0D0D' : colors.background,
    header:  isDark ? '#111111' : colors.primaryDark,
    card:    isDark ? '#181818' : colors.white,
    border:  isDark ? '#252525' : colors.border,
    text:    isDark ? '#EFEFEF' : colors.text,
    text2:   isDark ? '#888888' : colors.textSecondary,
    text3:   isDark ? '#555555' : colors.textLight,
    input:   isDark ? '#222222' : colors.white,
    inputBd: isDark ? '#333333' : colors.border,
    rowBd:   isDark ? '#252525' : colors.border,
  };

  const handleChangePassword = () => {
    setPwdError(null);
    setPwdSuccess(null);
    if (!currentPwd || !newPwd || !confirmPwd)
      return setPwdError('Tous les champs sont obligatoires.');
    if (newPwd !== confirmPwd)
      return setPwdError('Les mots de passe ne correspondent pas.');
    if (newPwd.length < 8)
      return setPwdError('Le mot de passe doit faire au moins 8 caractères.');

    // TODO Sprint 2 : appeler authService.changePassword(currentPwd, newPwd)
    setPwdSuccess('Mot de passe modifié avec succès.');
    setTimeout(() => {
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setPwdSuccess(null);
      setActiveSection(null);
    }, 2000);
  };

  const handleLogout = () => {
    Alert.alert(
      'Se déconnecter ?',
      'Vous devrez vous reconnecter pour accéder à votre profil.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: () => {
          // TODO : authService.logout() puis navigation vers Landing
          onClose();
        }},
      ]
    );
  };

  // ── Menu items ─────────────────────────────────────────────
  const menuItems = [
    {
      icon: '👤',
      iconBg: isDark ? '#1B3A2D' : '#E8F5E9',
      label: 'Mon profil',
      sub:   'Modifier mes informations',
      onPress: () => onClose(), // TODO : naviguer vers l'écran profil
    },
    {
      icon: '🔑',
      iconBg: isDark ? '#2A1F3D' : '#F3E5F5',
      label: 'Changer le mot de passe',
      sub:   'Sécurité du compte',
      onPress: () => setActiveSection(activeSection === 'password' ? null : 'password'),
      isExpanded: activeSection === 'password',
    },
    {
      icon: '🔔',
      iconBg: isDark ? '#1A1F3D' : '#E8EAF6',
      label: 'Notifications',
      sub:   'SMS, WhatsApp, alertes',
      onPress: () => setActiveSection(activeSection === 'notifications' ? null : 'notifications'),
      isExpanded: activeSection === 'notifications',
    },
    {
      icon: '🌍',
      iconBg: isDark ? '#2C2A00' : '#FFFDE7',
      label: 'Langue',
      sub:   'Français',
      onPress: () => {},
    },
    {
      icon: '🔒',
      iconBg: isDark ? '#3A1A1A' : '#FBE8EC',
      label: 'Codes professionnels',
      sub:   'Gérer les accès institutionnels',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: th.bg }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={th.header}
      />

      {/* ── HEADER PROFIL ── */}
      <View style={[styles.header, { backgroundColor: th.header }]}>
        {/* Bande drapeau */}
        <View style={styles.flagBar}>
          <View style={{ flex: 1, backgroundColor: colors.green }} />
          <View style={{ flex: 1, backgroundColor: colors.yellow }} />
          <View style={{ flex: 1, backgroundColor: colors.red }} />
        </View>

        {/* Barre top */}
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Mon compte</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Infos utilisateur */}
        <View style={styles.userRow}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>👨🏾‍🦱</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>BOTRE-LARE Abdou</Text>
            <Text style={styles.userEmail}>+228 97 83 92 88</Text>
            <View style={styles.userBadge}>
              <Text style={styles.userBadgeText}>Adulte</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── MENU ── */}
      <ScrollView
        style={[styles.body, { backgroundColor: th.bg }]}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Menu items */}
        <View style={[styles.section, { backgroundColor: th.card, borderColor: th.border }]}>
          {menuItems.map((item, i) => (
            <View key={i}>
              <TouchableOpacity
                style={[
                  styles.menuRow,
                  { borderBottomColor: th.rowBd },
                  i === menuItems.length - 1 && !item.isExpanded && { borderBottomWidth: 0 },
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                  <Text style={{ fontSize: 15 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: th.text }]}>{item.label}</Text>
                  <Text style={[styles.menuSub, { color: th.text2 }]}>{item.sub}</Text>
                </View>
                <Text style={[styles.menuChevron, { color: th.text3 }]}>
                  {item.isExpanded ? '∨' : '›'}
                </Text>
              </TouchableOpacity>

              {/* Section mot de passe expansible */}
              {item.isExpanded && activeSection === 'password' && (
                <View style={[styles.expanded, { borderBottomColor: th.rowBd }]}>
                  {[
                    { label: 'Mot de passe actuel', value: currentPwd, setter: setCurrentPwd },
                    { label: 'Nouveau mot de passe', value: newPwd,     setter: setNewPwd },
                    { label: 'Confirmer',            value: confirmPwd,  setter: setConfirmPwd },
                  ].map((f, fi) => (
                    <View key={fi} style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: th.text2 }]}>{f.label}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: th.input, borderColor: th.inputBd, color: th.text }]}
                        value={f.value}
                        onChangeText={f.setter}
                        secureTextEntry={!showPwd}
                        placeholder="••••••••"
                        placeholderTextColor={th.text3}
                        autoCapitalize="none"
                      />
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.showPwdBtn}
                    onPress={() => setShowPwd(!showPwd)}
                  >
                    <Text style={[styles.showPwdText, { color: colors.primary }]}>
                      {showPwd ? 'Masquer' : 'Afficher'} les mots de passe
                    </Text>
                  </TouchableOpacity>

                  {pwdError && (
                    <View style={styles.inlineErrorBox}>
                      <Text style={styles.inlineErrorText}>{pwdError}</Text>
                    </View>
                  )}
                  {pwdSuccess && (
                    <View style={styles.inlineSuccessBox}>
                      <Text style={styles.inlineSuccessText}>{pwdSuccess}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.savePwdBtn}
                    onPress={handleChangePassword}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.savePwdText}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Section notifications expansible */}
              {item.isExpanded && activeSection === 'notifications' && (
                <View style={[styles.expanded, { borderBottomColor: th.rowBd }]}>
                  {[
                    { label: 'SMS',         sub: 'Fonctionne sans internet', value: notifSMS,      setter: setNotifSMS },
                    { label: 'WhatsApp',    sub: 'Nécessite internet',        value: notifWhatsApp, setter: setNotifWhatsApp },
                    { label: 'Scans QR',    sub: 'Notifier à chaque scan',    value: notifScan,     setter: setNotifScan },
                  ].map((n, ni) => (
                    <View key={ni} style={[styles.notifRow, { borderBottomColor: th.rowBd }, ni === 2 && { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifLabel, { color: th.text }]}>{n.label}</Text>
                        <Text style={[styles.notifSub, { color: th.text2 }]}>{n.sub}</Text>
                      </View>
                      <Switch
                        value={n.value}
                        onValueChange={n.setter}
                        trackColor={{ false: th.border, true: colors.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Toggle thème sombre */}
        <View style={[styles.section, { backgroundColor: th.card, borderColor: th.border }]}>
          <View style={[styles.menuRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.menuIcon, { backgroundColor: isDark ? '#1A1A1A' : '#212121' }]}>
              <Text style={{ fontSize: 15 }}>🌙</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: th.text }]}>Thème sombre</Text>
              <Text style={[styles.menuSub, { color: th.text2 }]}>
                {isDark ? 'Activé' : 'Désactivé'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={onToggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Déconnexion */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: isDark ? '#1A0808' : '#FBE8EC', borderColor: isDark ? '#3A1A1A' : '#FFCDD2' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1 },
  header:          { paddingBottom: 20 },
  flagBar:         { flexDirection: 'row', height: 3, marginBottom: 14 },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, marginBottom: 16,
  },
  headerTitle:     { fontSize: fontSizes.md, fontFamily: fonts.bold, color: '#fff' },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  closeIcon:       { fontSize: 20, color: 'rgba(255,255,255,0.7)', lineHeight: 22 },
  userRow:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18 },
  userAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.yellow,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  userAvatarText:  { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.primaryDark },
  userName:        { fontSize: fontSizes.md, fontFamily: fonts.bold, color: '#fff' },
  userEmail:       { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  userBadge:       { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  userBadgeText:   { fontSize: fontSizes.xs, fontFamily: fonts.semiBold, color: 'rgba(255,255,255,0.8)' },
  body:            { flex: 1 },
  bodyContent:     { padding: 14, gap: 10 },
  section: {
    borderRadius: 14, borderWidth: 0.5,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  menuIcon:        { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuLabel:       { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  menuSub:         { fontSize: fontSizes.xs, fontFamily: fonts.regular, marginTop: 1 },
  menuChevron:     { fontSize: 16 },
  expanded:        { paddingHorizontal: 14, paddingBottom: 14, borderBottomWidth: 0.5 },
  inputField:      { marginTop: 10 },
  inputLabel:      { fontSize: fontSizes.xs, fontFamily: fonts.medium, marginBottom: 5 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: fontSizes.sm, fontFamily: fonts.regular,
  },
  showPwdBtn:      { marginTop: 8, alignSelf: 'flex-start' },
  showPwdText:     { fontSize: fontSizes.xs, fontFamily: fonts.medium },
  savePwdBtn:      { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  savePwdText:     { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: '#fff' },
  notifRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 0.5,
  },
  notifLabel:      { fontSize: fontSizes.sm, fontFamily: fonts.semiBold },
  notifSub:        { fontSize: fontSizes.xs, fontFamily: fonts.regular, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 0.5,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  logoutText:      { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.danger },
  inlineErrorBox: { backgroundColor: '#FDECEA', padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#F5C6CB' },
  inlineErrorText: { color: '#721C24', fontFamily: fonts.medium, fontSize: fontSizes.xs, textAlign: 'center' },
  inlineSuccessBox: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#C8E6C9' },
  inlineSuccessText: { color: '#2E7D32', fontFamily: fonts.medium, fontSize: fontSizes.xs, textAlign: 'center' },
});
