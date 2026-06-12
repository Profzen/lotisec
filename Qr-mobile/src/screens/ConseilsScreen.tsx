import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Linking, Image,
  LayoutAnimation, Platform, UIManager, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fontSizes, fonts } from '../theme/typography';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Conseil = {
  id:          string;
  icon:        string;
  titre:       string;
  categorie:   string;
  couleur:     string;
  couleurBg:   string;
  imageUrl:    string;
  imageCredit: string;
  etapes:      string[];
  important?:  string;
};

const CONSEILS: Conseil[] = [
  {
    id: '1', icon: '🚨', titre: 'Accident de la route',
    categorie: 'Urgence', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80',
    imageCredit: 'Secours routier · Unsplash',
    etapes: [
      'Sécurisez la zone — allumez vos feux de détresse et placez le triangle de signalisation',
      'Appelez le 118 (pompiers) ou le 15 (SAMU) immédiatement',
      'Ne déplacez pas la victime sauf danger immédiat (feu, noyade)',
      'Vérifiez la conscience : parlez-lui fort, tapotez doucement son épaule',
      'Si inconsciente et ne respire pas : commencez la RCP',
      'Couvrez la victime pour éviter l\'hypothermie',
      'Restez avec elle jusqu\'à l\'arrivée des secours',
    ],
    important: 'Ne donnez jamais à boire à une personne accidentée',
  },
  {
    id: '2', icon: '❤️', titre: 'Réanimation cardio-pulmonaire (RCP)',
    categorie: 'Premiers secours', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&q=80',
    imageCredit: 'Premiers secours · Unsplash',
    etapes: [
      'Allongez la victime sur le dos sur une surface dure',
      'Penchez sa tête en arrière pour dégager les voies respiratoires',
      'Vérifiez la respiration pendant 10 secondes maximum',
      'Placez vos mains au centre de la poitrine',
      'Appuyez fort et vite : 30 compressions à 5–6 cm de profondeur',
      'Donnez 2 insufflations (bouche-à-bouche) si vous êtes formé',
      'Continuez le cycle 30 compressions / 2 insufflations jusqu\'aux secours',
    ],
    important: 'Commencez dès que possible — chaque minute compte !',
  },
  {
    id: '3', icon: '🩸', titre: 'Arrêter un saignement',
    categorie: 'Premiers secours', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
    imageCredit: 'Soins médicaux · Unsplash',
    etapes: [
      'Portez des gants si disponibles pour vous protéger',
      'Appuyez fermement sur la plaie avec un tissu propre ou une compresse',
      'Maintenez la pression sans relâcher pendant au moins 10 minutes',
      'Si le sang traverse, ajoutez du tissu par-dessus sans enlever le premier',
      'Élevez le membre blessé au-dessus du niveau du cœur si possible',
      'Ne retirez jamais un objet planté dans la plaie',
      'Appelez le 118 si le saignement est abondant',
    ],
  },
  {
    id: '4', icon: '🏍️', titre: 'Sécurité à moto',
    categorie: 'Prévention', couleur: '#007A3D', couleurBg: '#F0F9F4',
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    imageCredit: 'Sécurité moto · Unsplash',
    etapes: [
      'Portez toujours votre casque homologué — il réduit les risques de décès de 40%',
      'Portez des vêtements de protection : gants, veste, bottes',
      'Vérifiez votre moto avant chaque trajet : pneus, freins, éclairage',
      'Respectez les limitations de vitesse — jamais au-dessus de 80 km/h en ville',
      'Restez visible : portez un gilet réfléchissant la nuit',
      'Ne conduisez jamais sous l\'emprise de l\'alcool ou de la fatigue',
      'Maintenez une distance de sécurité d\'au moins 2 secondes',
    ],
    important: 'Le casque sauve des vies — portez-le à chaque trajet',
  },
  {
    id: '5', icon: '🚦', titre: 'Respect du code de la route',
    categorie: 'Prévention', couleur: '#007A3D', couleurBg: '#F0F9F4',
    imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80',
    imageCredit: 'Code de la route · Unsplash',
    etapes: [
      'Respectez les feux rouges — ne jamais les griller même si la route semble libre',
      'Cédez le passage aux piétons sur les passages cloutés',
      'Limitez votre vitesse : 50 km/h en ville, 90 km/h sur route',
      'Ne téléphonez jamais en conduisant — utilisez le kit mains libres',
      'Utilisez vos clignotants avant chaque changement de direction',
      'Ne doublez jamais dans un virage ou sur une ligne blanche continue',
      'Gardez vos papiers de voiture, assurance et permis à jour',
    ],
    important: 'Un feu rouge grillé peut coûter une vie',
  },
  {
    id: '6', icon: '🌧️', titre: 'Conduite par temps de pluie',
    categorie: 'Prévention', couleur: '#007A3D', couleurBg: '#F0F9F4',
    imageUrl: 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=800&q=80',
    imageCredit: 'Conduite pluie · Unsplash',
    etapes: [
      'Réduisez votre vitesse de 20 à 30% par rapport au temps sec',
      'Augmentez la distance de sécurité — la distance de freinage double sur sol mouillé',
      'Allumez vos feux de croisement même en journée',
      'Évitez les flaques d\'eau — elles peuvent cacher des trous profonds',
      'Ne freinez pas brutalement — freinez progressivement',
      'Vérifiez l\'état de vos essuie-glaces avant la saison des pluies',
      'En cas d\'aquaplaning : lâchez l\'accélérateur sans freiner brusquement',
    ],
  },
  {
    id: '7', icon: '🔥', titre: 'Incendie de véhicule',
    categorie: 'Urgence', couleur: '#FF6B00', couleurBg: '#FFF4EC',
    imageUrl: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&q=80',
    imageCredit: 'Incendie · Unsplash',
    etapes: [
      'Arrêtez le véhicule immédiatement et coupez le moteur',
      'Faites sortir tous les passagers rapidement',
      'Éloignez-vous d\'au moins 50 mètres du véhicule',
      'N\'ouvrez jamais le capot si vous voyez de la fumée',
      'Appelez le 118 immédiatement',
      'N\'essayez pas d\'éteindre le feu vous-même si les flammes sont importantes',
      'Prévenez les autres conducteurs avec vos feux de détresse',
    ],
    important: 'Ne retournez jamais chercher vos affaires dans un véhicule en feu',
  },
  {
    id: '8', icon: '👶', titre: 'Sécurité des enfants en voiture',
    categorie: 'Prévention', couleur: '#007A3D', couleurBg: '#F0F9F4',
    imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80',
    imageCredit: 'Sécurité enfants · Unsplash',
    etapes: [
      'Utilisez toujours un siège auto adapté au poids et à la taille de l\'enfant',
      'Les enfants de moins de 10 ans voyagent obligatoirement à l\'arrière',
      'Ne placez jamais un siège bébé dos à la route côté airbag actif',
      'Vérifiez que les portières sont bien verrouillées avec le sécurité enfant',
      'Ne laissez jamais un enfant seul dans une voiture, même quelques minutes',
      'Apprenez aux enfants à attacher leur ceinture automatiquement',
      'Expliquez-leur les règles de sécurité routière dès le plus jeune âge',
    ],
  },
  {
    id: '9', icon: '😵', titre: 'Victime inconsciente',
    categorie: 'Premiers secours', couleur: '#D21034', couleurBg: '#FEF0F0',
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&q=80',
    imageCredit: 'Secours médicaux · Unsplash',
    etapes: [
      'Appelez à l\'aide et demandez à quelqu\'un d\'appeler le 118',
      'Vérifiez sa conscience : parlez fort, tapotez l\'épaule',
      'Si elle ne répond pas, vérifiez sa respiration pendant 10 secondes',
      'Si elle respire : placez-la en Position Latérale de Sécurité (PLS)',
      'Si elle ne respire pas : commencez la RCP immédiatement',
      'Ne donnez rien à boire ni à manger',
      'Surveillez sa respiration jusqu\'à l\'arrivée des secours',
    ],
    important: 'La PLS évite l\'étouffement en cas de vomissements',
  },
];

const CATEGORIES = ['Tout', 'Urgence', 'Premiers secours', 'Prévention'];
const CATEGORIE_ICONS: Record<string, string> = {
  'Tout': '📋', 'Urgence': '🚨', 'Premiers secours': '🏥', 'Prévention': '🛡️',
};

export default function ConseilsScreen() {
  const [categorieActive, setCategorieActive] = useState('Tout');
  const [conseilOuvert,   setConseilOuvert]   = useState<string | null>(null);
  const [imagesChargees,  setImagesChargees]  = useState<Record<string, boolean>>({});

  const conseilsFiltres = categorieActive === 'Tout'
    ? CONSEILS
    : CONSEILS.filter(c => c.categorie === categorieActive);

  const toggleConseil = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setConseilOuvert(prev => prev === id ? null : id);
  };

  const statsCategorie = (cat: string) =>
    cat === 'Tout' ? CONSEILS.length : CONSEILS.filter(c => c.categorie === cat).length;

  // ─── Rendu carte conseil ──────────────────────────────────
  const renderConseil = ({ item: conseil, index }: { item: Conseil; index: number }) => {
    const estOuvert = conseilOuvert === conseil.id;
    return (
      <View style={styles.conseilWrapper}>
        <TouchableOpacity
          style={[
            styles.conseilCard,
            { borderLeftColor: conseil.couleur },
            estOuvert && { borderColor: conseil.couleur, borderWidth: 1.5 },
          ]}
          onPress={() => toggleConseil(conseil.id)}
          activeOpacity={0.88}
        >
          {/* Header carte */}
          <View style={styles.conseilHeader}>
            <View style={[styles.conseilIconWrap, { backgroundColor: conseil.couleurBg }]}>
              <Text style={styles.conseilIcon}>{conseil.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.conseilTitre}>{conseil.titre}</Text>
              <View style={styles.conseilMeta}>
                <View style={[styles.categorieBadge, { backgroundColor: conseil.couleurBg }]}>
                  <Text style={[styles.categorieText, { color: conseil.couleur }]}>
                    {conseil.categorie}
                  </Text>
                </View>
                <Text style={styles.etapesCount}>{conseil.etapes.length} étapes</Text>
              </View>
            </View>
            <View style={[
              styles.chevronWrap,
              estOuvert && { backgroundColor: conseil.couleur, borderColor: conseil.couleur },
            ]}>
              <Text style={[styles.chevron, { color: estOuvert ? '#fff' : conseil.couleur }]}>
                {estOuvert ? '∧' : '∨'}
              </Text>
            </View>
          </View>

          {/* Contenu déplié */}
          {estOuvert && (
            <View style={styles.conseilContenu}>

              {/* Image */}
              <View style={styles.imageContainer}>
                {!imagesChargees[conseil.id] && (
                  <View style={[styles.imagePlaceholder, { backgroundColor: conseil.couleurBg }]}>
                    <Text style={{ fontSize: 40 }}>{conseil.icon}</Text>
                    <Text style={[styles.imagePlaceholderText, { color: conseil.couleur }]}>
                      Chargement...
                    </Text>
                  </View>
                )}
                <Image
                  source={{ uri: conseil.imageUrl }}
                  style={[
                    styles.image,
                    !imagesChargees[conseil.id] && { position: 'absolute', opacity: 0 },
                  ]}
                  onLoad={() => setImagesChargees(p => ({ ...p, [conseil.id]: true }))}
                  resizeMode="cover"
                />
                <View style={[styles.imageOverlay, { backgroundColor: conseil.couleur + '40' }]} />
                <View style={styles.imageBadge}>
                  <Text style={{ fontSize: 14 }}>{conseil.icon}</Text>
                  <Text style={styles.imageBadgeText}>{conseil.titre}</Text>
                </View>
                <Text style={styles.imageCredit}>{conseil.imageCredit}</Text>
              </View>

              <View style={[styles.separateur, { backgroundColor: conseil.couleur + '30' }]} />

              {/* Étapes */}
              <Text style={styles.etapesTitre}>À faire étape par étape</Text>
              {conseil.etapes.map((etape, i) => (
                <View key={i} style={styles.etapeRow}>
                  <View style={[styles.etapeNum, { backgroundColor: conseil.couleur }]}>
                    <Text style={styles.etapeNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.etapeText}>{etape}</Text>
                </View>
              ))}

              {/* Important */}
              {conseil.important && (
                <View style={[styles.importantBox, {
                  backgroundColor: conseil.couleurBg,
                  borderColor: conseil.couleur,
                }]}>
                  <View style={[styles.importantIcon, { backgroundColor: conseil.couleur }]}>
                    <Text style={{ fontSize: 14, color: '#fff' }}>⚠</Text>
                  </View>
                  <Text style={[styles.importantText, { color: conseil.couleur }]}>
                    {conseil.important}
                  </Text>
                </View>
              )}

              {/* Bouton appeler */}
              <TouchableOpacity
                style={[styles.appelBtn, { backgroundColor: conseil.couleur }]}
                onPress={() => Linking.openURL('tel:118')}
                activeOpacity={0.85}
              >
                <Text style={styles.appelBtnText}><FontAwesome name="phone" size={16} /> Appeler le 118 — Pompiers</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* Badge numéro */}
        <View style={[styles.numBadge, { backgroundColor: conseil.couleur }]}>
          <Text style={styles.numBadgeText}>{index + 1}</Text>
        </View>
      </View>
    );
  };

  // ─── Footer ───────────────────────────────────────────────
  const renderFooter = () => (
    <View style={styles.footer}>
      <Text style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</Text>
      <Text style={styles.footerText}>
        Ces conseils sont fournis à titre informatif. En cas d'urgence, appelez toujours les secours professionnels.
      </Text>
    </View>
  );

  // ─── Contenu avant la liste (numéros + stats) ─────────────
  const renderListHeader = () => (
    <View>
      {/* Numéros d'urgence */}
      <View style={styles.urgenceCard}>
        <View style={styles.urgenceHeaderRow}>
          <View style={styles.urgenceDot} />
          <Text style={styles.urgenceTitle}>Numéros d'urgence</Text>
        </View>
        <Text style={styles.urgenceSubtitle}>
          Composez immédiatement en cas d'accident
        </Text>
        <View style={styles.urgenceRow}>
          {[
            { label: 'Pompiers', num: '118', icon: '🚒', bg: '#D21034' },
            { label: 'SAMU',    num: '15',  icon: '🚑', bg: '#1565C0' },
            { label: 'Police',  num: '117', icon: '🚔', bg: '#4A4A4A' },
          ].map(item => (
            <TouchableOpacity
              key={item.num}
              style={[styles.urgenceBtn, { backgroundColor: item.bg }]}
              onPress={() => Linking.openURL(`tel:${item.num}`)}
              activeOpacity={0.82}
            >
              <Text style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</Text>
              <Text style={styles.urgenceNum}>{item.num}</Text>
              <Text style={styles.urgenceLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stats rapides */}
      <View style={styles.statsRow}>
        {[
          { label: 'Urgences',      count: 2, color: '#D21034', bg: '#FEF0F0' },
          { label: 'Premiers sec.', count: 3, color: '#1565C0', bg: '#E3F2FD' },
          { label: 'Prévention',    count: 4, color: '#007A3D', bg: '#F0F9F4' },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
            <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── HEADER FIXE — reste en haut au défilement ── */}
      <View style={styles.header}>
        <View style={styles.flagBar}>
          <View style={[styles.flagStripe, { backgroundColor: colors.green }]} />
          <View style={[styles.flagStripe, { backgroundColor: colors.yellow }]} />
          <View style={[styles.flagStripe, { backgroundColor: colors.red }]} />
        </View>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Conseils de sécurité</Text>
            <Text style={styles.subtitle}>
              Les gestes qui sauvent · Prévention routière
            </Text>
          </View>
         
        </View>
      </View>

      {/* ── FILTRES FIXES — restent sous le header ── */}
      <View style={styles.filtresWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtresContent}
          bounces={false}
        >
          {CATEGORIES.map(cat => {
            const actif = categorieActive === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filtreBtn, actif && styles.filtreBtnActive]}
                onPress={() => setCategorieActive(cat)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14 }}>{CATEGORIE_ICONS[cat]}</Text>
                <Text style={[styles.filtreText, actif && styles.filtreTextActive]}>
                  {cat}
                </Text>
                <View style={[styles.filtreBadge, actif && styles.filtreBadgeActive]}>
                  <Text style={[styles.filtreBadgeText, actif && { color: colors.primary }]}>
                    {statsCategorie(cat)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LISTE SCROLLABLE ── */}
      <FlatList
        data={conseilsFiltres}
        keyExtractor={item => item.id}
        renderItem={renderConseil}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Header fixe ──
  header: {
    backgroundColor: colors.primary,
  },
  flagBar:   { flexDirection: 'row', height: 3 },
  flagStripe:{ flex: 1 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
  },
  title: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bold,
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.65)',
  },
  headerBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#074d16e3',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText:  { fontSize: fontSizes.lg, fontFamily: fonts.bold,    color: '#fff' },
  headerBadgeLabel: { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)' },

  // ── Filtres fixes ──
  filtresWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtresContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  filtreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filtreBtnActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
  filtreText:       { fontSize: fontSizes.xs, fontFamily: fonts.semiBold, color: colors.textSecondary },
  filtreTextActive: { color: '#fff' },
  filtreBadge: {
    backgroundColor: colors.border,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  filtreBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filtreBadgeText:   { fontSize: 9, fontFamily: fonts.bold, color: colors.textSecondary },

  // ── Liste ──
  listContent: { padding: 16, paddingBottom: 32, gap: 12 },

  // Numéros urgence
  urgenceCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderLeftWidth: 4,
    borderLeftColor: colors.red,
    padding: 16,
    marginBottom: 12,
  },
  urgenceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  urgenceDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  urgenceTitle:     { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.red },
  urgenceSubtitle:  { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.textSecondary, marginBottom: 12, marginLeft: 16 },
  urgenceRow:       { flexDirection: 'row', gap: 10 },
  urgenceBtn:       { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 2 },
  urgenceNum:       { fontSize: fontSizes.xl, fontFamily: fonts.bold, color: '#fff' },
  urgenceLabel:     { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)' },

  // Stats
  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:  { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statCount: { fontSize: fontSizes.xl, fontFamily: fonts.bold },
  statLabel: { fontSize: fontSizes.xs, fontFamily: fonts.medium, marginTop: 2 },

  // Conseil
  conseilWrapper: { position: 'relative', marginBottom: 12 },
  conseilCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  conseilHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  conseilIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  conseilIcon:   { fontSize: 22 },
  conseilTitre:  { fontSize: fontSizes.md, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 5 },
  conseilMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categorieBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  categorieText: { fontSize: fontSizes.xs, fontFamily: fonts.semiBold },
  etapesCount:   { fontSize: fontSizes.xs, fontFamily: fonts.regular, color: colors.textLight },
  chevronWrap: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chevron: { fontSize: 14 },

  // Contenu déplié
  conseilContenu: { paddingHorizontal: 14, paddingBottom: 16 },

  // Image
  imageContainer: {
    height: 200, borderRadius: 12, overflow: 'hidden',
    marginBottom: 14, position: 'relative', backgroundColor: '#F5F5F5',
  },
  image:              { width: '100%', height: '100%' },
  imagePlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  imagePlaceholderText: { fontSize: fontSizes.sm, fontFamily: fonts.medium },
  imageOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  imageBadge: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  imageBadgeText: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, color: '#fff' },
  imageCredit: {
    position: 'absolute', bottom: 6, right: 8,
    fontSize: 9, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.5)',
  },

  separateur:    { height: 1, marginBottom: 14 },
  etapesTitre: {
    fontSize: fontSizes.xs, fontFamily: fonts.semiBold,
    color: colors.textSecondary, letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 10,
  },
  etapeRow:  { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  etapeNum: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  etapeNumText: { fontSize: fontSizes.xs, fontFamily: fonts.bold, color: '#fff' },
  etapeText: {
    fontSize: fontSizes.sm, fontFamily: fonts.regular,
    color: colors.text, lineHeight: 20, flex: 1,
  },

  importantBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10, marginBottom: 12,
  },
  importantIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  importantText: { fontSize: fontSizes.sm, fontFamily: fonts.semiBold, flex: 1, lineHeight: 20 },

  appelBtn:     { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  appelBtnText: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: '#fff' },

  numBadge: {
    position: 'absolute', top: -6, right: 12,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  numBadgeText: { fontSize: 9, fontFamily: fonts.bold, color: '#fff' },

  footer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 8, backgroundColor: colors.white,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  footerText: {
    fontSize: fontSizes.xs, fontFamily: fonts.regular,
    color: colors.textSecondary, lineHeight: 18, flex: 1,
  },
});