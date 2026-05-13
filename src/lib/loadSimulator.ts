import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const LoadSimulator = {
  // Simulate a burst of rides
  async simulateDispatchSpike(numRides: number) {
    console.log(`Starting dispatch spike simulation: ${numRides} rides`);
    const promises = [];
    
    for (let i = 0; i < numRides; i++) {
      const p = addDoc(collection(db, 'rides'), {
        rider_id: `sim_rider_${i}`,
        pickup: { address: 'Thamel, Kathmandu', lat: 27.7153, lng: 85.3123 },
        destination: { address: 'Patan Durbar Square', lat: 27.6734, lng: 85.3248 },
        vehicle_type: 'bike',
        fare: 150,
        status: 'pending',
        created_at: new Date().toISOString(),
        payment_method: 'cash',
        is_simulated: true // Tag it for easy cleanup
      });
      promises.push(p);
    }
    
    await Promise.allSettled(promises);
    console.log(`Dispatch spike complete.`);
  },

  // Simulate multiple drivers coming online
  async simulateConcurrentDrivers(numDrivers: number) {
    console.log(`Simulating ${numDrivers} concurrent drivers going online`);
    const promises = [];
    
    for (let i = 0; i < numDrivers; i++) {
        const p = addDoc(collection(db, 'driver_locations'), {
            driver_id: `sim_driver_${i}`,
            lat: 27.7153 + (Math.random() - 0.5) * 0.01,
            lng: 85.3123 + (Math.random() - 0.5) * 0.01,
            status: 'online',
            updatedAt: serverTimestamp(),
            is_simulated: true
        });
        promises.push(p);
    }
    
    await Promise.allSettled(promises);
    console.log('Driver simulation complete.');
  },
  
  // Clean up
  async cleanupSimulatedData() {
    console.warn('Cleanup requires admin privileges, usually handled via Cloud Functions or Admin SDK script.');
  }
};
