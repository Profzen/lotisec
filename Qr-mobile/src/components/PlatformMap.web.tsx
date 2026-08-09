import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

type Coordinate = { latitude: number; longitude: number };

type MapProps = {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Coordinate & { latitudeDelta: number; longitudeDelta: number };
  onPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  mapType?: string;
};

// Injection unique des dépendances Leaflet CSS et JS sur le Web
let leafletLoadingPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletLoadingPromise) return leafletLoadingPromise;

  leafletLoadingPromise = new Promise((resolve) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return leafletLoadingPromise;
}

export default class PlatformMap extends React.Component<MapProps> {
  private mapContainerRef = React.createRef<HTMLDivElement>();
  private leafletMap: any = null;
  private markersLayer: any = null;
  private polylinesLayer: any = null;

  async componentDidMount() {
    const L = await loadLeaflet();
    if (!L || !this.mapContainerRef.current) {
      this.props.onMapReady?.();
      return;
    }

    const lat = this.props.initialRegion?.latitude || 6.1375;
    const lng = this.props.initialRegion?.longitude || 1.2125;
    const zoom = 14;

    try {
      this.leafletMap = L.map(this.mapContainerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(this.leafletMap);

      // Tuiles CartoDB / OpenStreetMap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.leafletMap);

      this.markersLayer = L.layerGroup().addTo(this.leafletMap);
      this.polylinesLayer = L.layerGroup().addTo(this.leafletMap);

      this.leafletMap.on('click', (e: any) => {
        if (this.props.onPress) {
          this.props.onPress({
            nativeEvent: {
              coordinate: {
                latitude: e.latlng.lat,
                longitude: e.latlng.lng,
              },
            },
          });
        }
      });

      this.updateLayers();
      this.props.onMapReady?.();
    } catch (e) {
      console.warn('Erreur initialisation carte Leaflet Web:', e);
      this.props.onMapReady?.();
    }
  }

  componentDidUpdate(prevProps: MapProps) {
    if (this.leafletMap) {
      this.updateLayers();
    }
  }

  componentWillUnmount() {
    if (this.leafletMap) {
      try {
        this.leafletMap.remove();
      } catch {}
      this.leafletMap = null;
    }
  }

  animateToRegion(region: Coordinate & { latitudeDelta?: number; longitudeDelta?: number }, duration = 800) {
    if (this.leafletMap && region) {
      const zoom = region.latitudeDelta && region.latitudeDelta < 0.02 ? 16 : 14;
      this.leafletMap.flyTo([region.latitude, region.longitude], zoom, { duration: duration / 1000 });
    }
  }

  fitToCoordinates(coords: Coordinate[], options?: any) {
    if (this.leafletMap && coords && coords.length > 0 && (window as any).L) {
      const L = (window as any).L;
      const bounds = L.latLngBounds(coords.map((c) => [c.latitude, c.longitude]));
      this.leafletMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  private updateLayers() {
    const L = (window as any).L;
    if (!L || !this.leafletMap) return;

    if (this.markersLayer) this.markersLayer.clearLayers();
    if (this.polylinesLayer) this.polylinesLayer.clearLayers();

    React.Children.forEach(this.props.children, (child: any) => {
      if (!child) return;

      if (child.type === Marker && child.props.coordinate) {
        const { latitude, longitude } = child.props.coordinate;
        const color = child.props.pinColor || '#1565D8';
        const customIcon = L.divIcon({
          className: 'lotisec-custom-marker',
          html: `<div style="width:24px;height:24px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 3px 6px rgba(0,0,0,0.35);"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([latitude, longitude], { icon: customIcon });
        if (child.props.title) {
          marker.bindTooltip(child.props.title, { permanent: false, direction: 'top' });
        }
        marker.addTo(this.markersLayer);
      }

      if (child.type === Polyline && child.props.coordinates && child.props.coordinates.length > 1) {
        const latLngs = child.props.coordinates.map((c: Coordinate) => [c.latitude, c.longitude]);
        const color = child.props.strokeColor || '#1565D8';
        const weight = child.props.strokeWidth || 4;
        const dashArray = child.props.lineDashPattern ? '6, 6' : undefined;
        L.polyline(latLngs, { color, weight, dashArray }).addTo(this.polylinesLayer);
      }
    });
  }

  render() {
    return (
      <View style={[styles.container, this.props.style]}>
        <div
          ref={this.mapContainerRef as any}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
        />
      </View>
    );
  }
}

export function Marker(_props: {
  coordinate: Coordinate;
  title?: string;
  pinColor?: string;
  children?: React.ReactNode;
}) {
  return null;
}

export function Polyline(_props: {
  coordinates: Coordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
}) {
  return null;
}

export function UrlTile(_props: {
  urlTemplate: string;
  maximumZ?: number;
  flipY?: boolean;
  tileSize?: number;
  zIndex?: number;
  shouldReplaceMapContent?: boolean;
}) {
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#EAF1F7',
  },
});
