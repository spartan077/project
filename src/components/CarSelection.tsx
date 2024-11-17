import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TAXI_PRICING } from '../lib/constants';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Car, Users, MapPin, Clock } from 'lucide-react';

interface CarSelectionProps {
  rideDetails: {
    source: string;
    destination: string;
    timeSlot: string;
    seatsRequired: number;
    genderPreference: string;
    userId: string;
    userDetails: any;
  };
}

export default function CarSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const rideDetails = location.state;
  const [loading, setLoading] = useState(false);

  // Redirect if no ride details
  if (!rideDetails) {
    navigate('/');
    return null;
  }

  // Get available cars based on route
  const getAvailableCars = () => {
    const routeKey = `${rideDetails.source.toLowerCase().replace(/\s+/g, '_')}_to_${rideDetails.destination.toLowerCase().replace(/\s+/g, '_')}`;
    console.log('Route key:', routeKey); // Debug log
    const route = TAXI_PRICING.routes[routeKey as keyof typeof TAXI_PRICING.routes];
    
    if (!route) {
      console.log('No route found for:', routeKey); // Debug log
      return [];
    }
    return [...route['4-seater'], ...route['6-seater']];
  };

  const availableCars = getAvailableCars();

  const handleCarSelect = async (carDetails: any) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ride_requests')
        .insert([
          {
            user_id: rideDetails.userId,
            source: rideDetails.source,
            destination: rideDetails.destination,
            time_slot: rideDetails.timeSlot,
            seats_required: rideDetails.seatsRequired,
            status: 'pending',
            gender_preference: rideDetails.genderPreference,
            selected_car: carDetails.car,
            car_details: carDetails,
            user_details: rideDetails.userDetails
          }
        ]);

      if (error) throw error;

      toast.success('Ride request created successfully!');
      navigate('/matches');
    } catch (error) {
      toast.error('Failed to create ride request');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Review Your Trip</h2>
        <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-gray-500" />
            <span>{rideDetails.source} → {rideDetails.destination}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <span>{new Date(rideDetails.timeSlot).toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-500" />
            <span>{rideDetails.seatsRequired} seats required</span>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">Select Your Car</h2>
      
      <div className="grid gap-6 md:grid-cols-2">
        {availableCars.map((car) => (
          <div 
            key={car.car}
            className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{car.car}</h3>
                <p className="text-gray-600">Max {car.max_passengers} passengers</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 line-through">₹{car.base_price}</p>
                <p className="text-2xl font-bold text-blue-600">₹{car.final_price}</p>
                <p className="text-green-600 text-sm">Save ₹{car.discount}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <p>✓ {car.distance_km} km journey</p>
              <p>✓ Toll charges included</p>
              <p>✓ AC vehicle</p>
              <p>✓ Clean & sanitized</p>
            </div>

            <button
              onClick={() => handleCarSelect(car)}
              disabled={loading || car.max_passengers < rideDetails.seatsRequired}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {car.max_passengers < rideDetails.seatsRequired 
                ? 'Not enough seats' 
                : loading ? 'Processing...' : 'Select This Car'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 