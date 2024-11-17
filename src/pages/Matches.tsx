import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TAXI_PRICING } from '../lib/constants';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/useAuth';
import { isAdmin } from '../lib/utils';
import type { RideRequest, RideGroup } from '../lib/types';
import AuthForm from '../components/AuthForm';
import { RideMembers } from '../components/RideMembers';

export default function Matches() {
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [groups, setGroups] = useState<Record<number, RideGroup>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showFemaleOnly, setShowFemaleOnly] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRequests();
      fetchGroups();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter requests based on gender preference and availability
      const filteredRequests = data.filter(request => {
        const group = groups[request.id];
        const remainingSeats = group ? group.remaining_capacity : request.seats_required;
        const isCreator = request.user_id === user?.id;

        // Show if user is admin, creator, or ride is available
        if (isAdmin(user) || isCreator || remainingSeats > 0) {
          // If user is male, hide female-only rides
          if (user?.user_metadata.gender === 'male' && request.gender_preference === 'female_only') {
            return false;
          }
          // If female user has toggled female-only, show only those rides
          if (showFemaleOnly && request.gender_preference !== 'female_only') {
            return false;
          }
          return true;
        }
        return false;
      });

      setRequests(filteredRequests || []);
    } catch (error) {
      toast.error('Failed to fetch ride requests');
      console.error('Error:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_groups')
        .select('*');

      if (error) throw error;

      const groupsMap = data.reduce((acc, group) => {
        acc[group.ride_request_id] = group;
        return acc;
      }, {} as Record<number, RideGroup>);

      setGroups(groupsMap);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRide = async (request: RideRequest) => {
    if (!user) {
      toast.error('Please login to join a ride');
      return;
    }

    try {
      console.log('Starting join process for request:', request);
      console.log('Current user:', user);

      // First check if user is the creator
      if (request.user_id === user.id) {
        toast.error("You can't join your own ride request");
        return;
      }

      const { data: existingGroups, error: fetchError } = await supabase
        .from('ride_groups')
        .select('*')
        .eq('ride_request_id', request.id)
        .single();

      console.log('Existing groups query result:', { existingGroups, fetchError });

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching groups:', fetchError);
        throw fetchError;
      }

      if (existingGroups?.members?.includes(user.id)) {
        toast.error('You have already joined this ride');
        return;
      }

      if (existingGroups) {
        console.log('Updating existing group:', existingGroups);
        // Update existing group
        const newMembers = [...(existingGroups.members || []), user.id];
        const newRemainingCapacity = existingGroups.total_capacity - newMembers.length;

        if (newRemainingCapacity < 0) {
          toast.error('This ride is already full');
          return;
        }

        const { error: updateError } = await supabase
          .from('ride_groups')
          .update({
            members: newMembers,
            remaining_capacity: newRemainingCapacity
          })
          .eq('id', existingGroups.id);

        console.log('Update result:', { updateError });

        if (updateError) throw updateError;
      } else {
        console.log('Creating new group for request:', request);
        // Create new group
        const newGroup = {
          ride_request_id: request.id,
          total_capacity: request.seats_required,
          remaining_capacity: request.seats_required - 1,
          members: [user.id]
        };

        const { error: insertError } = await supabase
          .from('ride_groups')
          .insert([newGroup]);

        console.log('Insert result:', { insertError });

        if (insertError) throw insertError;
      }

      toast.success('Successfully joined the ride!');
      navigate('/confirmation');
    } catch (error: any) {
      console.error('Full error details:', error);
      toast.error(error.message || 'Failed to join ride');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      // Check if user is admin or creator
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      if (!isAdmin(user) && request.user_id !== user?.id) {
        toast.error('You can only cancel your own requests');
        return;
      }

      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Ride request cancelled successfully');
      fetchRequests(); // Refresh the list
    } catch (error) {
      toast.error('Failed to cancel ride request');
      console.error('Error:', error);
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Please Login</h1>
        <AuthForm />
      </div>
    );
  }

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">Available Rides</h1>
      
      <div className="grid gap-6">
        {user?.user_metadata.gender === 'female' && (
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showFemaleOnly}
                onChange={(e) => setShowFemaleOnly(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Show female-only rides</span>
            </label>
          </div>
        )}

        {requests.map((request) => {
          const group = groups[request.id];
          const remainingSeats = group ? group.remaining_capacity : request.seats_required;
          const isUserInGroup = group?.members.includes(user.id);
          const isCreator = request.user_id === user?.id;
          const perPersonPrice = Math.round(
            request.car_details.final_price / 
            (request.car_details.car.includes('6-seater') ? 6 : 4)
          );

          return (
            <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-gray-500" />
                  <span className="text-lg font-medium">
                    {request.source} → {request.destination}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <span>{new Date(request.time_slot).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-gray-500" />
                  <span>Created by: {request.user_details.full_name}</span>
                </div>
                <div className="text-sm space-x-2">
                  {request.gender_preference === 'female_only' && (
                    <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded-full">
                      Female passengers only
                    </span>
                  )}
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {request.car_details.car}
                  </span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    ₹{perPersonPrice}/person
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-sm ${remainingSeats === 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                  {remainingSeats === 0 ? 'Ride Full' : `${remainingSeats} seats remaining`}
                </span>
                <div className="space-x-2">
                  {(isAdmin(user) || isCreator) && (
                    <button
                      onClick={() => handleCancelRequest(request.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Cancel Ride
                    </button>
                  )}
                  <button
                    onClick={() => handleJoinRide(request)}
                    disabled={isUserInGroup || remainingSeats === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUserInGroup ? 'Already Joined' : remainingSeats === 0 ? 'Full' : 'Join Ride'}
                  </button>
                </div>
              </div>

              {/* Show RideMembers for admin, creator, or group members */}
              {(isAdmin(user) || isCreator || isUserInGroup) && request.ride_groups?.map(group => (
                <RideMembers
                  key={group.id}
                  groupId={group.id.toString()}
                  isCreator={request.user_id === user.id}
                />
              ))}
            </div>
          );
        })}

        {requests.length === 0 && (
          <div className="text-center text-gray-500">
            No ride requests available at the moment.
          </div>
        )}
      </div>
    </div>
  );
}