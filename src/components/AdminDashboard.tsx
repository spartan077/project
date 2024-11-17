import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isAdmin } from '../lib/utils';

interface RideGroup {
  id: string;
  ride_request_id: string;
  total_capacity: number;
  remaining_capacity: number;
  members: string[];
  ride_request: {
    source: string;
    destination: string;
    time_slot: string;
    gender_preference: string;
    user_id: string;
    car_details: {
      car: string;
      base_price: number;
      final_price: number;
      max_passengers: number;
    };
  };
  creator_details?: {
    full_name: string;
    phone_number: string;
  };
  member_details?: {
    id: string;
    full_name: string;
    phone_number: string;
  }[];
}

interface MemberDetail {
  id: string;
  full_name: string;
  phone_number: string;
}

export default function AdminDashboard() {
  const [groups, setGroups] = useState<RideGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAdmin();
    fetchGroups();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchGroups = async () => {
    try {
      console.log('Fetching groups...');
      
      // First get all ride groups with basic ride request info
      const { data: basicGroups, error: groupsError } = await supabase
        .from('ride_groups')
        .select(`
          *,
          ride_request:ride_requests(
            source,
            destination,
            time_slot,
            gender_preference,
            user_id,
            car_details
          )
        `)
        .order('created_at', { ascending: false });

      if (groupsError) {
        console.error('Error fetching basic groups:', groupsError);
        throw groupsError;
      }

      console.log('Basic groups:', basicGroups);

      // Then fetch all the details
      const groupsWithDetails = await Promise.all(
        basicGroups.map(async (group) => {
          // Get creator details
          const { data: creatorData } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number')
            .eq('id', group.ride_request.user_id)
            .single();

          // Get member details including the creator
          let memberDetails: MemberDetail[] = [];
          const allMembers = [...(group.members || []), group.ride_request.user_id];
          
          if (allMembers.length > 0) {
            console.log('Fetching member details for:', allMembers);
            const { data: members, error: membersError } = await supabase
              .from('profiles')
              .select('id, full_name, phone_number')
              .in('id', allMembers);

            if (membersError) {
              console.error('Error fetching member details:', membersError);
            }
            memberDetails = members || [];
            console.log('Member details:', memberDetails);
          }

          return {
            ...group,
            creator_details: creatorData || { full_name: 'Unknown', phone_number: 'No phone' },
            member_details: memberDetails
          };
        })
      );

      console.log('Final groups with details:', groupsWithDetails);
      setGroups(groupsWithDetails);
    } catch (error) {
      console.error('Error in fetchGroups:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin(user)) {
    return <div className="text-center p-8 text-red-600">Access denied. Admin only.</div>;
  }

  if (loading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Car Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creator
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {group.ride_request.source} → {group.ride_request.destination}
                  </div>
                  <div className="text-xs text-gray-500">
                    Gender: {group.ride_request.gender_preference || 'Any'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500">
                    {new Date(group.ride_request.time_slot).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {group.ride_request.car_details.car}
                  </div>
                  <div className="text-sm text-gray-500">
                    ₹{group.ride_request.car_details.final_price}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {group.creator_details?.full_name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {group.creator_details?.phone_number || 'No phone'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    {group.member_details?.map((member) => (
                      <div key={member.id} className="text-sm">
                        <div className="font-medium">{member.full_name}</div>
                        <div className="text-gray-500">{member.phone_number}</div>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    group.remaining_capacity === 0 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {group.remaining_capacity === 0 
                      ? 'Full' 
                      : `${group.remaining_capacity} seats left`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 
