import React from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapLibreGL, { MapViewRef, CameraRef } from '@maplibre/maplibre-react-native';

// Désactiver tout appel à un token Mapbox
MapLibreGL.setAccessToken(null);

export const CARTO_VOYAGER =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';

const CARTO_VOYAGER_STYLE = {
  version: 8,
  name: 'CARTO Voyager',
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '(c) OpenStreetMap contributors, (c) CARTO',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

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
    typeof coordinate.latitude !== 'number' ||
    typeof coordinate.longitude !== 'number'
  ) {
    return null;
  }
  const markerId =
    id ||
    `marker-${title || 'pt'}-${coordinate.longitude.toFixed(5)}-${coordinate.latitude.toFixed(5)}`;
  const coords: [number, number] = [coordinate.longitude, coordinate.latitude];

  return (
    <MapLibreGL.PointAnnotation
      id={markerId}
      coordinate={coords}
      title={title}
      snippet={description}
      onSelected={onPress ? () => onPress() : undefined}
    >
      {children ? (
        React.isValidElement(children) ? (
          children
        ) : (
          <View>{children}</View>
        )
      ) : (
        <View style={styles.defaultMarkerContainer}>
          <View style={[styles.defaultMarkerPin, { backgroundColor: pinColor }]}>
            <View style={styles.defaultMarkerDot} />
          </View>
        </View>
      )}
    </MapLibreGL.PointAnnotation>
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
  if (!coordinates || coordinates.length < 2) return null;

  const polylineId =
    id ||
    `poly-${coordinates.length}-${coordinates[0].latitude.toFixed(4)}-${coordinates[0].longitude.toFixed(4)}`;

  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
    },
  };

  return (
    <MapLibreGL.ShapeSource id={`source-${polylineId}`} shape={geojson}>
      <MapLibreGL.LineLayer
        id={`layer-${polylineId}`}
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
    </MapLibreGL.ShapeSource>
  );
}

export function UrlTile(_props?: any) {
  return null;
}

interface PlatformMapState {
  mapLoading: boolean;
  mapReady: boolean;
  mapError: string | null;
}

export default class PlatformMap extends React.Component<any, PlatformMapState> {
  private mapRef = React.createRef<MapViewRef>();
  private cameraRef = React.createRef<CameraRef>();
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

  private handlePress = (feature: any) => {
    if (this.props.onPress) {
      const coords = feature?.geometry?.coordinates;
      if (coords && Array.isArray(coords)) {
        this.props.onPress({
          nativeEvent: {
            coordinate: {
              latitude: coords[1],
              longitude: coords[0],
            },
          },
        });
      }
    }
  };

  private handleRegionDidChange = (feature: any) => {
    if (this.props.onRegionChangeComplete) {
      const coords = feature?.geometry?.coordinates;
      const bounds = feature?.properties?.visibleBounds;
      if (coords && Array.isArray(coords)) {
        const [centerLng, centerLat] = coords;
        let latitudeDelta = 0.04;
        let longitudeDelta = 0.04;
        if (bounds && bounds.length === 2) {
          const [[neLng, neLat], [swLng, swLat]] = bounds;
          latitudeDelta = Math.abs(neLat - swLat);
          longitudeDelta = Math.abs(neLng - swLng);
        }
        this.props.onRegionChangeComplete({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta,
          longitudeDelta,
        });
      }
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
    if (!region || typeof region.latitude !== 'number' || typeof region.longitude !== 'number') {
      return;
    }
    const zoomLevel = region.latitudeDelta
      ? Math.min(
          20,
          Math.max(
            1,
            Math.round(Math.log(360 / Math.max(region.latitudeDelta, 0.0001)) / Math.LN2)
          )
        )
      : 14;

    this.cameraRef.current?.setCamera({
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel,
      animationDuration: duration,
      animationMode: 'flyTo',
    });
  }

  fitToCoordinates(
    coords: Array<{ latitude: number; longitude: number }>,
    options?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    }
  ) {
    if (!coords || coords.length === 0) return;
    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const padding = options?.edgePadding;
    this.cameraRef.current?.setCamera({
      bounds: {
        ne: [maxLng, maxLat],
        sw: [minLng, minLat],
        paddingTop: padding?.top ?? 50,
        paddingRight: padding?.right ?? 50,
        paddingBottom: padding?.bottom ?? 50,
        paddingLeft: padding?.left ?? 50,
      },
      animationDuration: options?.animated === false ? 0 : 800,
      animationMode: 'easeTo',
    });
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
      ? [initialRegion.longitude, initialRegion.latitude]
      : [1.2125, 6.1375]; // Lomé fallback

    const initialZoom: number = initialRegion?.latitudeDelta
      ? Math.min(
          20,
          Math.max(
            1,
            Math.round(
              Math.log(360 / Math.max(initialRegion.latitudeDelta, 0.0001)) / Math.LN2
            )
          )
        )
      : 13;

    return (
      <View style={[styles.container, style]}>
        <MapLibreGL.MapView
          ref={this.mapRef}
          style={StyleSheet.absoluteFillObject}
          mapStyle={CARTO_VOYAGER_STYLE}
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
          <MapLibreGL.Camera
            ref={this.cameraRef}
            defaultSettings={{
              centerCoordinate: initialCenter,
              zoomLevel: initialZoom,
            }}
          />
          {showsUserLocation ? (
            <MapLibreGL.UserLocation
              visible={true}
              renderMode="native"
              androidRenderMode="normal"
              showsUserHeadingIndicator={false}
            />
          ) : null}
          {children}
        </MapLibreGL.MapView>

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
  defaultMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  defaultMarkerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  defaultMarkerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
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
