import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

type Coordinate = { latitude: number; longitude: number };

type MapProps = {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Coordinate & { latitudeDelta?: number; longitudeDelta?: number };
  onPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  loadingEnabled?: boolean;
};

export const Marker = (_props: { coordinate: Coordinate; title?: string; pinColor?: string; children?: React.ReactNode }) => null;
export const Polyline = (_props: { coordinates: Coordinate[]; strokeColor?: string; strokeWidth?: number }) => null;
export const UrlTile = (_props: any) => null;

const DEFAULT_CENTER = { latitude: 6.1375, longitude: 1.2125 };

export default class PlatformMap extends React.Component<MapProps, { hasError: boolean; isReady: boolean }> {
  private webViewRef = React.createRef<WebView>();
  private isMountedRef = false;

  constructor(props: MapProps) {
    super(props);
    this.state = { hasError: false, isReady: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[PlatformMap] Erreur interceptée dans la carte native:', error);
  }

  componentDidMount() {
    this.isMountedRef = true;
  }

  componentWillUnmount() {
    this.isMountedRef = false;
  }

  componentDidUpdate(prevProps: MapProps) {
    if (!this.state.isReady) return;
    this.syncLayers();
  }

  animateToRegion(region: Coordinate & { latitudeDelta?: number; longitudeDelta?: number }, duration = 800) {
    if (!region || !Number.isFinite(region.latitude) || !Number.isFinite(region.longitude)) return;
    const dur = Math.max(0.2, duration / 1000);
    const zoom = region.latitudeDelta && region.latitudeDelta < 0.03 ? 15 : 13;
    const js = `
      if (window.map) {
        window.map.flyTo([${region.latitude}, ${region.longitude}], ${zoom}, { duration: ${dur} });
      }
      true;
    `;
    this.webViewRef.current?.injectJavaScript(js);
  }

  fitToCoordinates(coords: Coordinate[], options?: { edgePadding?: { top: number; right: number; bottom: number; left: number }; animated?: boolean }) {
    if (!coords || coords.length === 0) return;
    const valid = coords.filter(c => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
    if (valid.length === 0) return;
    const bounds = valid.map(c => [c.latitude, c.longitude]);
    const js = `
      if (window.map) {
        window.map.fitBounds(${JSON.stringify(bounds)}, { padding: [30, 30] });
      }
      true;
    `;
    this.webViewRef.current?.injectJavaScript(js);
  }

  private extractMarkersAndLines() {
    const markers: any[] = [];
    const lines: any[] = [];

    React.Children.forEach(this.props.children, (child: any) => {
      if (!child || !child.props) return;
      if (child.props.coordinate && Number.isFinite(child.props.coordinate.latitude)) {
        markers.push({
          latitude: child.props.coordinate.latitude,
          longitude: child.props.coordinate.longitude,
          title: child.props.title || '',
          color: child.props.pinColor || '#1366F3',
        });
      } else if (Array.isArray(child.props.coordinates) && child.props.coordinates.length > 0) {
        const validCoords = child.props.coordinates
          .filter((c: any) => c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
          .map((c: any) => [c.latitude, c.longitude]);
        if (validCoords.length > 0) {
          lines.push({
            coords: validCoords,
            color: child.props.strokeColor || '#1366F3',
            width: child.props.strokeWidth || 4,
          });
        }
      }
    });

    return { markers, lines };
  }

  private syncLayers() {
    const { markers, lines } = this.extractMarkersAndLines();
    const js = `
      if (window.updateLayers) {
        window.updateLayers(${JSON.stringify(markers)}, ${JSON.stringify(lines)});
      }
      true;
    `;
    this.webViewRef.current?.injectJavaScript(js);
  }

  private onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        if (this.isMountedRef) {
          this.setState({ isReady: true }, () => {
            this.syncLayers();
            this.props.onMapReady?.();
          });
        }
      } else if (data.type === 'press' && this.props.onPress) {
        this.props.onPress({
          nativeEvent: {
            coordinate: data.coordinate,
          },
        });
      }
    } catch {}
  };

  private getHtml() {
    const lat = this.props.initialRegion?.latitude ?? DEFAULT_CENTER.latitude;
    const lng = this.props.initialRegion?.longitude ?? DEFAULT_CENTER.longitude;
    const zoom = 14;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #EAF1F7; }
    .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }
    .pulse-pin {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([${lat}, ${lng}], ${zoom});

      L.tileLayer('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      var markersGroup = L.layerGroup().addTo(map);
      var polylinesGroup = L.layerGroup().addTo(map);

      map.on('click', function(e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'press',
            coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
          }));
        }
      });

      window.updateLayers = function(markers, lines) {
        markersGroup.clearLayers();
        polylinesGroup.clearLayers();

        if (Array.isArray(markers)) {
          markers.forEach(function(m) {
            var icon = L.divIcon({
              className: '',
              html: '<div class="pulse-pin" style="background:' + (m.color || '#1366F3') + '"></div>',
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            });
            var marker = L.marker([m.latitude, m.longitude], { icon: icon });
            if (m.title) marker.bindPopup(m.title);
            marker.addTo(markersGroup);
          });
        }

        if (Array.isArray(lines)) {
          lines.forEach(function(l) {
            L.polyline(l.coords, {
              color: l.color || '#1366F3',
              weight: l.width || 4,
              opacity: 0.85,
              lineJoin: 'round'
            }).addTo(polylinesGroup);
          });
        }
      };

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }
    } catch(err) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }
    }
  </script>
</body>
</html>`;
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, styles.errorContainer, this.props.style]}>
          <Text style={styles.errorText}>Carte temporairement indisponible</Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, this.props.style]}>
        <WebView
          ref={this.webViewRef}
          style={StyleSheet.absoluteFillObject}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={false}
          scrollEnabled={false}
          bounces={false}
          onMessage={this.onMessage}
          source={{ html: this.getHtml() }}
        />
        {!this.state.isReady && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="small" color="#1366F3" />
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF1F7',
    overflow: 'hidden',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 241, 247, 0.4)',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
