import React from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  UrlTile as NativeUrlTile,
  MapUrlTileProps,
  Region,
} from 'react-native-maps';

export { Marker, Polyline };

const CARTO_VOYAGER =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';

export function UrlTile(props: Partial<MapUrlTileProps> & { urlTemplate?: string }) {
  const { urlTemplate = CARTO_VOYAGER, ...rest } = props;
  return (
    <NativeUrlTile
      maximumZ={19}
      flipY={false}
      tileSize={256}
      zIndex={1}
      {...rest}
      urlTemplate={urlTemplate}
    />
  );
}

interface PlatformMapState {
  mapLoading: boolean;
  mapReady: boolean;
  mapError: string | null;
}

export default class PlatformMap extends React.Component<any, PlatformMapState> {
  private mapRef = React.createRef<MapView>();
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
    console.log('[MAP] mounting');
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
        console.warn('[MAP] timeout after 8s');
        this.setState({
          mapLoading: false,
          mapError: 'Impossible de charger la carte. Vérifiez votre connexion Internet.',
        });
      }
    }, 8500);
  }

  private handleMapReady = () => {
    console.log('[MAP] ready');
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.setState({ mapLoading: false, mapReady: true, mapError: null });
    if (this.props.onMapReady) {
      this.props.onMapReady();
    }
  };

  private handleMapLoaded = () => {
    console.log('[MAP] loaded');
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.setState({ mapLoading: false, mapReady: true, mapError: null });
    if (this.props.onMapLoaded) {
      this.props.onMapLoaded();
    }
  };

  private retryLoading = () => {
    console.log('[MAP] retry requested');
    this.setState({ mapLoading: true, mapError: null, mapReady: false });
    this.startLoadTimeout();
  };

  animateToRegion(region: Region, duration = 800) {
    this.mapRef.current?.animateToRegion(region, duration);
  }

  fitToCoordinates(
    coords: Array<{ latitude: number; longitude: number }>,
    options?: {
      edgePadding?: { top: number; right: number; bottom: number; left: number };
      animated?: boolean;
    }
  ) {
    if (!coords || coords.length === 0) return;
    this.mapRef.current?.fitToCoordinates(coords, {
      edgePadding: options?.edgePadding ?? { top: 50, right: 50, bottom: 50, left: 50 },
      animated: options?.animated ?? true,
    });
  }

  render() {
    const { children, style, mapType, ...rest } = this.props;
    const { mapLoading, mapError } = this.state;

    const hasChildTile = React.Children.toArray(children).some(
      (child: any) =>
        child?.type === NativeUrlTile ||
        child?.type === UrlTile ||
        child?.props?.urlTemplate
    );

    return (
      <View style={[styles.container, style]}>
        <MapView
          ref={this.mapRef}
          style={StyleSheet.absoluteFillObject}
          mapType={mapType || 'none'}
          loadingEnabled={false}
          onMapReady={this.handleMapReady}
          onMapLoaded={this.handleMapLoaded}
          {...rest}
        >
          {!hasChildTile && <UrlTile />}
          {children}
        </MapView>

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
