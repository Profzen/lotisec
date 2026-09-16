import React from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import * as MapLibreRN from '@maplibre/maplibre-react-native';

export const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';

export interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  id?: string;
}

export function Marker({
  coordinate,
  title,
  description,
  pinColor = '#1565D8',
  children,
  onPress,
  id,
}: MarkerProps) {
  if (
    !coordinate ||
    !Number.isFinite(Number(coordinate.latitude)) ||
    !Number.isFinite(Number(coordinate.longitude))
  ) {
    return null;
  }

  const lat = Number(coordinate.latitude);
  const lng = Number(coordinate.longitude);

  // Clé d'identification stable et sans caractères spéciaux
  const rawKey = id || title || 'marker';
  const cleanKey = rawKey
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 32);

  // Si un composant enfant personnalisé est fourni, utiliser PointAnnotation
  if (children) {
    const markerId = `pt-${cleanKey}`;
    return (
      <MapLibreRN.PointAnnotation
        id={markerId}
        coordinate={[lng, lat]}
        title={title}
        snippet={description}
        onSelected={onPress}
      >
        {React.isValidElement(children) ? children : <View>{children}</View>}
      </MapLibreRN.PointAnnotation>
    );
  }

  // Pour les marqueurs standard (départ, destination, moto, intervention),
  // utiliser ShapeSource + CircleLayer natif GPU pour garantir une stabilité
  // absolue sur Android sans création de View native hors écran.
  const sourceId = `src-m-${cleanKey}`;
  const pointFeature: GeoJSON.Feature<GeoJSON.Point> = {
    type: 'Feature',
    properties: {
      id: cleanKey,
      title: title || '',
    },
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
  };

  return (
    <MapLibreRN.ShapeSource
      id={sourceId}
      shape={pointFeature}
      onPress={onPress ? () => onPress() : undefined}
    >
      {/* Halo blanc extérieur */}
      <MapLibreRN.CircleLayer
        id={`layer-outer-${cleanKey}`}
        style={{
          circleRadius: 10,
          circleColor: '#FFFFFF',
          circleStrokeWidth: 1.5,
          circleStrokeColor: 'rgba(0,0,0,0.3)',
        }}
      />
      {/* Cercle principal teinté */}
      <MapLibreRN.CircleLayer
        id={`layer-inner-${cleanKey}`}
        style={{
          circleRadius: 8,
          circleColor: pinColor,
        }}
      />
      {/* Pastille blanche centrale */}
      <MapLibreRN.CircleLayer
        id={`layer-dot-${cleanKey}`}
        style={{
          circleRadius: 3,
          circleColor: '#FFFFFF',
        }}
      />
    </MapLibreRN.ShapeSource>
  );
}

export interface PolylineProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  id?: string;
}

export function Polyline({
  coordinates,
  strokeColor = '#1565D8',
  strokeWidth = 3,
  lineDashPattern,
  id,
}: PolylineProps) {
  if (!coordinates || !Array.isArray(coordinates)) return null;

  const validPoints = coordinates.filter(
    (c) =>
      c &&
      Number.isFinite(Number(c.latitude)) &&
      Number.isFinite(Number(c.longitude))
  );

  if (validPoints.length < 2) return null;

  const rawKey = id || 'route';
  const cleanKey = rawKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 32);

  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: validPoints.map((c) => [Number(c.longitude), Number(c.latitude)]),
    },
  };

  return (
    <MapLibreRN.ShapeSource id={`src-poly-${cleanKey}`} shape={geojson}>
      <MapLibreRN.LineLayer
        id={`layer-poly-${cleanKey}`}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
          lineDasharray:
            lineDashPattern && lineDashPattern.length >= 2
              ? [lineDashPattern[0], lineDashPattern[1]]
              : undefined,
        }}
      />
    </MapLibreRN.ShapeSource>
  );
}

export function UrlTile(_props?: any) {
  return null;
}

function extractCoordinates(
  eventOrFeature: any
): { latitude: number; longitude: number } | null {
  if (!eventOrFeature) return null;

  if (Array.isArray(eventOrFeature) && eventOrFeature.length >= 2) {
    const lng = Number(eventOrFeature[0]);
    const lat = Number(eventOrFeature[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  const raw =
    eventOrFeature.nativeEvent?.payload ??
    eventOrFeature.payload ??
    eventOrFeature.nativeEvent ??
    eventOrFeature;

  if (raw?.geometry?.coordinates && Array.isArray(raw.geometry.coordinates)) {
    const coords = raw.geometry.coordinates;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  if (raw?.coordinates) {
    if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
      const lng = Number(raw.coordinates[0]);
      const lat = Number(raw.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    } else if (typeof raw.coordinates === 'object') {
      const lat = Number(raw.coordinates.latitude ?? raw.coordinates.lat);
      const lng = Number(
        raw.coordinates.longitude ?? raw.coordinates.lng ?? raw.coordinates.lon
      );
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  if (raw?.lngLat) {
    if (Array.isArray(raw.lngLat) && raw.lngLat.length >= 2) {
      const lng = Number(raw.lngLat[0]);
      const lat = Number(raw.lngLat[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    } else if (typeof raw.lngLat === 'object') {
      const lat = Number(raw.lngLat.lat ?? raw.lngLat.latitude);
      const lng = Number(
        raw.lngLat.lng ?? raw.lngLat.lon ?? raw.lngLat.longitude
      );
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  if (raw?.coordinate) {
    const lat = Number(raw.coordinate.latitude ?? raw.coordinate.lat);
    const lng = Number(
      raw.coordinate.longitude ?? raw.coordinate.lng ?? raw.coordinate.lon
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  const directLat = Number(raw?.latitude ?? raw?.lat);
  const directLng = Number(raw?.longitude ?? raw?.lng ?? raw?.lon);
  if (Number.isFinite(directLat) && Number.isFinite(directLng)) {
    return { latitude: directLat, longitude: directLng };
  }

  return null;
}

interface PlatformMapState {
  mapLoading: boolean;
  mapReady: boolean;
  mapError: string | null;
}

export default class PlatformMap extends React.Component<any, PlatformMapState> {
  private mapRef = React.createRef<MapLibreRN.MapViewRef>();
  private cameraRef = React.createRef<MapLibreRN.CameraRef>();
  private timeoutTimer: any = null;

  constructor(props: any) {
    super(props);
    this.state = {
      mapLoading: true,
      mapReady: false,
      mapError: null,
    };
  }

  componentDidMount() {
    this.startLoadTimeout();
  }

  componentWillUnmount() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }
  }

  private startLoadTimeout() {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      if (!this.state.mapReady) {
        this.setState({
          mapLoading: false,
          mapError: 'Impossible de charger la carte. Vérifiez votre connexion Internet.',
        });
      }
    }, 8500);
  }

  private handleMapReady = () => {
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    if (!this.state.mapReady) {
      this.setState({ mapLoading: false, mapReady: true, mapError: null });
      if (this.props.onMapReady) {
        this.props.onMapReady();
      }
    }
  };

  private retryLoading = () => {
    this.setState({ mapLoading: true, mapError: null, mapReady: false });
    this.startLoadTimeout();
  };

  private handlePress = (featureOrEvent: any) => {
    if (!this.props.onPress) return;
    try {
      const extracted = extractCoordinates(featureOrEvent);
      if (
        extracted &&
        Number.isFinite(extracted.latitude) &&
        Number.isFinite(extracted.longitude)
      ) {
        this.props.onPress({
          nativeEvent: {
            coordinate: {
              latitude: extracted.latitude,
              longitude: extracted.longitude,
            },
          },
        });
      } else {
        console.warn('[MAP TOUCH] Clic sans coordonnées valides ignoré:', featureOrEvent);
      }
    } catch (err) {
      console.warn('[MAP TOUCH] Erreur traitement onPress:', err);
    }
  };

  private handleRegionDidChange = (featureOrEvent: any) => {
    if (!this.props.onRegionChangeComplete) return;
    try {
      if (!featureOrEvent) return;
      const raw =
        featureOrEvent.nativeEvent?.payload ??
        featureOrEvent.payload ??
        featureOrEvent.nativeEvent ??
        featureOrEvent;

      const coords = raw?.geometry?.coordinates ?? raw?.coordinates;
      let centerLat = 6.1375;
      let centerLng = 1.2125;

      if (Array.isArray(coords) && coords.length >= 2) {
        const cLng = Number(coords[0]);
        const cLat = Number(coords[1]);
        if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
          centerLat = cLat;
          centerLng = cLng;
        }
      }

      let latitudeDelta = 0.04;
      let longitudeDelta = 0.04;
      const bounds = raw?.properties?.visibleBounds;
      if (Array.isArray(bounds) && bounds.length === 2) {
        const [ne, sw] = bounds;
        if (
          Array.isArray(ne) &&
          Array.isArray(sw) &&
          ne.length >= 2 &&
          sw.length >= 2
        ) {
          const latDiff = Math.abs(Number(ne[1]) - Number(sw[1]));
          const lngDiff = Math.abs(Number(ne[0]) - Number(sw[0]));
          if (Number.isFinite(latDiff) && latDiff > 0) latitudeDelta = latDiff;
          if (Number.isFinite(lngDiff) && lngDiff > 0) longitudeDelta = lngDiff;
        }
      }

      this.props.onRegionChangeComplete({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta,
        longitudeDelta,
      });
    } catch (err) {
      console.warn('[MAP] Erreur onRegionDidChange:', err);
    }
  };

  animateToRegion(
    region: {
      latitude: number;
      longitude: number;
      latitudeDelta?: number;
      longitudeDelta?: number;
    },
    duration = 800
  ) {
    try {
      if (!region) return;
      const lat = Number(region.latitude);
      const lng = Number(region.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const delta = Number(region.latitudeDelta ?? region.longitudeDelta);
      let zoomLevel = 14;
      if (Number.isFinite(delta) && delta > 0) {
        const safeDelta = Math.max(0.0005, Math.min(delta, 180));
        zoomLevel = Math.round(Math.log(360 / safeDelta) / Math.LN2);
      }
      zoomLevel = Math.max(2, Math.min(zoomLevel, 19));

      this.cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel,
        animationDuration: Math.max(0, duration),
        animationMode: 'flyTo',
      });
    } catch (err) {
      console.warn('[MAP] Erreur animateToRegion:', err);
    }
  }

  fitToCoordinates(
    coords: Array<{ latitude: number; longitude: number }>,
    options?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    }
  ) {
    try {
      if (!coords || !Array.isArray(coords) || coords.length === 0) return;

      const valid = coords.filter((c) => {
        if (!c) return false;
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        return (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        );
      });

      if (valid.length === 0) return;

      const duration = options?.animated === false ? 0 : 800;

      if (valid.length === 1) {
        const lat = Number(valid[0].latitude);
        const lng = Number(valid[0].longitude);
        this.cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 15,
          animationDuration: duration,
          animationMode: 'easeTo',
        });
        return;
      }

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;

      for (const c of valid) {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }

      const deltaLat = maxLat - minLat;
      const deltaLng = maxLng - minLng;
      const MARGIN = 0.005;

      const neLat = deltaLat < 0.0001 ? maxLat + MARGIN : maxLat;
      const swLat = deltaLat < 0.0001 ? minLat - MARGIN : minLat;
      const neLng = deltaLng < 0.0001 ? maxLng + MARGIN : maxLng;
      const swLng = deltaLng < 0.0001 ? minLng - MARGIN : minLng;

      const ne: [number, number] = [neLng, neLat];
      const sw: [number, number] = [swLng, swLat];

      const top = Math.max(0, Number(options?.edgePadding?.top) || 50);
      const right = Math.max(0, Number(options?.edgePadding?.right) || 50);
      const bottom = Math.max(0, Number(options?.edgePadding?.bottom) || 50);
      const left = Math.max(0, Number(options?.edgePadding?.left) || 50);

      this.cameraRef.current?.fitBounds(
        ne,
        sw,
        [top, right, bottom, left],
        duration
      );
    } catch (err) {
      console.warn('[MAP] Erreur fitToCoordinates:', err);
    }
  }

  render() {
    const {
      children,
      style,
      initialRegion,
      showsUserLocation,
      showsMyLocationButton: _ignoredMyLocationButton,
      onRegionChangeComplete: _ignoredRegionChange,
      onMapReady: _ignoredMapReady,
      onPress: _ignoredPress,
      mapType: _ignoredMapType,
      ...rest
    } = this.props;

    const { mapLoading, mapError } = this.state;

    const initialCenter: [number, number] = initialRegion
      ? [Number(initialRegion.longitude) || 1.2125, Number(initialRegion.latitude) || 6.1375]
      : [1.2125, 6.1375];

    const delta = Number(initialRegion?.latitudeDelta);
    const initialZoom: number =
      Number.isFinite(delta) && delta > 0
        ? Math.min(
            19,
            Math.max(
              2,
              Math.round(Math.log(360 / Math.max(delta, 0.0005)) / Math.LN2)
            )
          )
        : 13;

    return (
      <View style={[styles.container, style]}>
        <MapLibreRN.MapView
          ref={this.mapRef}
          style={StyleSheet.absoluteFillObject}
          mapStyle={OPENFREEMAP_LIBERTY}
          logoEnabled={false}
          attributionEnabled={true}
          attributionPosition={{ bottom: 8, right: 8 }}
          compassEnabled={false}
          onPress={this.handlePress}
          onRegionDidChange={this.handleRegionDidChange}
          onDidFinishLoadingMap={this.handleMapReady}
          onDidFinishRenderingMap={this.handleMapReady}
          {...rest}
        >
          <MapLibreRN.Camera
            ref={this.cameraRef}
            defaultSettings={{
              centerCoordinate: initialCenter,
              zoomLevel: initialZoom,
            }}
          />
          {showsUserLocation ? (
            <MapLibreRN.UserLocation
              visible={true}
              renderMode="native"
              androidRenderMode="normal"
              showsUserHeadingIndicator={false}
            />
          ) : null}
          {children}
        </MapLibreRN.MapView>

        {mapLoading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#1565D8" />
            <Text style={styles.loadingText}>Chargement de la carte...</Text>
          </View>
        )}

        {mapError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{mapError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={this.retryLoading}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#EAF1F7',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(234, 241, 247, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#1565D8',
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#1565D8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
