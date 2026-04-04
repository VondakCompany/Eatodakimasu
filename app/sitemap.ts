import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabaseClient';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ⚠️ Replace this with your actual live domain URL
  const baseUrl = 'https://eatodakimasu.com'; 

  // 1. Fetch only the IDs and timestamps of APPROVED restaurants
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, created_at')
    .eq('status', 'approved');

  // 2. Map the database results into Google's required sitemap format
  const restaurantUrls = (restaurants || []).map((restaurant) => ({
    url: `${baseUrl}/restaurant/${restaurant.id}`,
    lastModified: new Date(restaurant.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8, // 0.8 is a good priority for secondary content pages
  }));

  // 3. Return the Homepage + all the dynamic restaurant pages
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0, // The homepage is the most important page
    },
    ...restaurantUrls,
  ];
}