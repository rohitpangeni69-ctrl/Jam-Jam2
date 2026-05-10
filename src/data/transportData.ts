import { Bike, Car, Truck, Bus } from 'lucide-react';

export const vehicleTypes = [
  {
    id: 'bike',
    name: 'Bike',
    description: 'Fastest for city traffic',
    icon: Bike,
    baseFare: 50,
    perKm: 20,
    capacity: 1,
  },
  {
    id: 'auto',
    name: 'Auto Rickshaw',
    description: 'Perfect for short trips',
    icon: Car, // Using Car as placeholder for Auto
    baseFare: 80,
    perKm: 35,
    capacity: 3,
  },
  {
    id: 'jeep',
    name: 'Jeep',
    description: 'Best for rural hilly roads',
    icon: Truck,
    baseFare: 200,
    perKm: 60,
    capacity: 8,
  },
  {
    id: 'bus',
    name: 'Local Bus',
    description: 'Echo friendly & cheap',
    icon: Bus,
    baseFare: 30,
    perKm: 10,
    capacity: 35,
  },
];

export const savedPlaces = [
  { id: '1', name: 'Home', address: 'Baluwatar, Kathmandu', lat: 27.7215, lng: 85.3301 },
  { id: '2', name: 'Work', address: 'Patan Durbar Square, Lalitpur', lat: 27.6737, lng: 85.3252 },
];

export const favoriteRoutes = [
  { id: '1', from: 'Kathmandu', to: 'Pokhara' },
];
