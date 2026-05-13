export type RideState = 'requested' | 'bidding' | 'accepted' | 'arriving' | 'started' | 'completed' | 'cancelled';

const VALID_TRANSITIONS: Record<RideState, RideState[]> = {
  requested: ['bidding', 'cancelled'],
  bidding: ['accepted', 'cancelled'],
  accepted: ['arriving', 'cancelled'],
  arriving: ['started', 'cancelled'],
  started: ['completed'], // Generally no cancel after trip starts, or needs specific penalty transition
  completed: [],
  cancelled: [],
};

/**
 * Validates whether a state transition is legal in the NepalRide lifecycle.
 */
export function canTransitionRideState(currentState: RideState, nextState: RideState): boolean {
  if (currentState === nextState) return true; // No-op
  return VALID_TRANSITIONS[currentState]?.includes(nextState) || false;
}

/**
 * Returns human-readable status for UI.
 */
export function getRideStatusText(state: RideState, role: 'rider' | 'driver'): string {
  switch (state) {
    case 'requested': return 'Searching for drivers...';
    case 'bidding': return role === 'rider' ? 'Drivers are bidding' : 'Bidding open';
    case 'accepted': return role === 'rider' ? 'Driver accepted' : 'You accepted the ride';
    case 'arriving': return role === 'rider' ? 'Driver is arriving' : 'Arriving at pickup';
    case 'started': return role === 'rider' ? 'En route to destination' : 'Driving to destination';
    case 'completed': return 'Ride completed';
    case 'cancelled': return 'Ride cancelled';
    default: return 'Unknown state';
  }
}
