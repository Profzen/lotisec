import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Coordinate = { latitude: number; longitude: number };

type MapProps = {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Coordinate & { latitudeDelta: number; longitudeDelta: number };
  onMapReady?: () => void;
};

export default class PlatformMap extends React.Component<MapProps> {
  componentDidMount() {
    this.props.onMapReady?.();
  }

  animateToRegion() {}

  fitToCoordinates() {}

  render() {
    return (
      <View style={[styles.map, this.props.style]}>
        <View style={styles.gridHorizontal} />
        <View style={styles.gridVertical} />
        <View style={styles.badge}>
          <Text style={styles.eyebrow}>APERÇU WEB</Text>
          <Text style={styles.title}>Carte et suivi GPS</Text>
          <Text style={styles.description}>
            Le parcours interactif complet est disponible dans l’application mobile.
          </Text>
        </View>
        {this.props.children}
      </View>
    );
  }
}

export function Marker({ children }: { children?: React.ReactNode }) {
  return children ? <View style={styles.marker}>{children}</View> : null;
}

export function Polyline() {
  return null;
}

export function UrlTile() {
  return null;
}

const styles = StyleSheet.create({
  map: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF1F7',
  },
  gridHorizontal: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(27, 74, 104, 0.12)',
    top: '33%',
    bottom: '33%',
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(27, 74, 104, 0.12)',
  },
  badge: {
    maxWidth: 320,
    margin: 24,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#173B52',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
  },
  eyebrow: {
    color: '#237A73',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 5,
    color: '#173B52',
    fontSize: 20,
    fontWeight: '800',
  },
  description: {
    marginTop: 7,
    color: '#597181',
    fontSize: 13,
    lineHeight: 19,
  },
  marker: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
});
