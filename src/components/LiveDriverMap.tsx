import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { subscribeToDriverLocation, LocationUpdate } from '@/lib/tracking';

// Fix Leaflet's default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const carIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3204/3204364.png', // A clear car icon (placeholder)
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const riderPinIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149059.png', // Standard pin
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

interface Props {
  rideId: string;
  riderLocation: { lat: number; lng: number };
  isDriver?: boolean;
}

// Map bounds updater component
function BoundsUpdater({ driverLoc, riderLoc }: { driverLoc: LocationUpdate | null, riderLoc: {lat: number, lng: number} }) {
  const map = useMap();

  useEffect(() => {
    if (driverLoc && riderLoc) {
      const bounds = L.latLngBounds([
        [driverLoc.lat, driverLoc.lng],
        [riderLoc.lat, riderLoc.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    } else if (riderLoc) {
      map.setView([riderLoc.lat, riderLoc.lng], 15);
    }
  }, [driverLoc, riderLoc, map]);

  return null;
}

export function LiveDriverMap({ rideId, riderLocation, isDriver = false }: Props) {
  const [driverLocation, setDriverLocation] = useState<LocationUpdate | null>(null);

  useEffect(() => {
    if (!rideId) return;
    
    // Subscribe to driver location on RTDB
    const unsubscribe = subscribeToDriverLocation(rideId, (loc) => {
      setDriverLocation(loc);
    });

    return () => {
      unsubscribe();
    };
  }, [rideId]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[riderLocation.lat, riderLocation.lng]} 
        zoom={15} 
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Rider / Pickup Location */}
        <Marker position={[riderLocation.lat, riderLocation.lng]} icon={riderPinIcon} />

        {/* Live Driver Car */}
        {(driverLocation || isDriver) && (
          <Marker 
            position={
              driverLocation 
                ? [driverLocation.lat, driverLocation.lng] 
                // For driver, we might mock it with their own GPS if driverLocation isn't updated, 
                // but RTDB syncs locally so driverLocation should normally exist.
                : [riderLocation.lat - 0.002, riderLocation.lng - 0.002] 
            } 
            icon={carIcon} 
          />
        )}

        <BoundsUpdater driverLoc={driverLocation} riderLoc={riderLocation} />
      </MapContainer>
    </div>
  );
}
