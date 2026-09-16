import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../components/BackButton';
import { colors } from '../theme/colors';

const CARTO_VOYAGER =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';

export default function MapDiagnosticScreen() {
  const [useCartoTiles, setUseCartoTiles] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton color={colors.text} />
        <Text style={styles.headerTitle}>Diagnostic MapView Natif</Text>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>
          {mapLoaded ? 'MapView Natif Initialisé' : 'Initialisation MapView...'}
        </Text>
        <Text style={styles.bannerSub}>
          {useCartoTiles
            ? 'Mode: Tuiles raster CARTO Voyager actives'
            : 'Mode: MapView Google Maps minimal standard'}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: 6.1375,
            longitude: 1.2125,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          mapType={useCartoTiles ? 'none' : 'standard'}
          onMapReady={() => {
            console.log('[DIAGNOSTIC] onMapReady');
            setMapLoaded(true);
          }}
          onMapLoaded={() => {
            console.log('[DIAGNOSTIC] onMapLoaded');
            setMapLoaded(true);
          }}
        >
          {useCartoTiles && (
            <UrlTile
              urlTemplate={CARTO_VOYAGER}
              maximumZ={19}
              flipY={false}
              tileSize={256}
              zIndex={1}
            />
          )}
        </MapView>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, useCartoTiles ? styles.btnActive : styles.btnInactive]}
          onPress={() => setUseCartoTiles(!useCartoTiles)}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {useCartoTiles ? 'Désactiver Tuiles CARTO' : 'Activer Tuiles CARTO (Voyager)'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 15,
  },
  banner: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  bannerSub: {
    fontSize: 12,
    color: '#388E3C',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
  },
  controls: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: '#2E7D32',
  },
  btnInactive: {
    backgroundColor: colors.primary,
  },
  btnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
