import { useState } from 'react';

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface RideState {
  pickup: Location | null;
  destination: Location | null;
  vehicleId: string | null;
  distance: number | null; // in km
  duration: number | null; // in minutes
  status: 'idle' | 'searching' | 'assigned' | 'arriving' | 'completed';
}

export function useRider() {
  const [ride, setRide] = useState<RideState>({
    pickup: null,
    destination: null,
    vehicleId: 'bike',
    distance: null,
    duration: null,
    status: 'idle',
  });

  const setPickup = (location: Location | null) => {
    setRide((p) => ({ ...p, pickup: location }));
  };

  const setDestination = (location: Location | null) => {
    setRide((p) => ({ ...p, destination: location }));
  };

  const setVehicle = (vehicleId: string) => {
    setRide((p) => ({ ...p, vehicleId }));
  };

  const setRouteDetails = (distance: number, duration: number) => {
    setRide((p) => ({ ...p, distance, duration }));
  };

  const setStatus = (status: RideState['status']) => {
    setRide((p) => ({ ...p, status }));
  };

  const resetRide = () => {
    setRide({
      pickup: null,
      destination: null,
      vehicleId: 'bike',
      distance: null,
      duration: null,
      status: 'idle',
    });
  };

  return {
    ride,
    setPickup,
    setDestination,
    setVehicle,
    setRouteDetails,
    setStatus,
    resetRide,
  };
}
