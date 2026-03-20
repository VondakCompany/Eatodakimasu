import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase keys. Make sure your .env.local is set up.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateDataFromUrl() {
  const url = 'https://www.eatodakimasu.com/';
  console.log(`🌐 Fetching data directly from ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('🔍 Extracting Wix data from the live HTML...');
    
    // Find all scripts and extract valid JSON blobs
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    const restaurantsRaw = [];
    
    // Recursive function to deeply search the JSON for restaurant items
    function findRestaurants(obj) {
      if (Array.isArray(obj)) {
        obj.forEach(findRestaurants);
      } else if (obj !== null && typeof obj === 'object') {
        // If the object looks like a restaurant (has title and restaurantArea), save it
        if (obj.title && obj.restaurantArea && Array.isArray(obj.restaurantArea)) {
          restaurantsRaw.push(obj);
        } else {
          Object.values(obj).forEach(findRestaurants);
        }
      }
    }

    while ((match = scriptRegex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content.startsWith('{') && content.endsWith('}')) {
        try {
          const data = JSON.parse(content);
          findRestaurants(data);
        } catch (e) {
          // Not a valid JSON block, ignore
        }
      }
    }

    // Wix often duplicates data in the payload, so we deduplicate by title
    const uniqueRestaurantsMap = new Map();
    restaurantsRaw.forEach(r => {
      uniqueRestaurantsMap.set(r.title, r);
    });
    
    // Map the Wix schema to our new Supabase Postgres schema
    const restaurantsToInsert = Array.from(uniqueRestaurantsMap.values()).map(item => {
      return {
        title: item.title,
        description: item.description || null,
        restaurant_price: item.restaurantPrice ? Number(item.restaurantPrice) : null,
        cuisine: Array.isArray(item.cuisine) ? item.cuisine : [],
        restaurant_area: Array.isArray(item.restaurantArea) ? item.restaurantArea : [],
        food_restrictions: Array.isArray(item.foodRestrictions) ? item.foodRestrictions : [],
        takeout_available: Array.isArray(item.takeOut) ? item.takeOut.includes('はい') : (item.takeOut === 'はい'),
        takeout_menu: item.takeout_menu || null,
        total_seats: item.totalSeats || null,
        avg_stay_time: item.avg_stay_time1 || null,
        status: 'approved' // Automatically approve imported locations
      };
    });

    if (restaurantsToInsert.length === 0) {
      console.log('⚠️ No restaurants found. The live site might be blocking the request or loading data differently.');
      return;
    }

    console.log(`✅ Found ${restaurantsToInsert.length} unique restaurants. Inserting into Supabase...`);

    // Bulk insert into Supabase
    const { data, error } = await supabase.from('restaurants').insert(restaurantsToInsert);

    if (error) {
      console.error('❌ Error inserting data into Supabase:', error);
    } else {
      console.log('🎉 Successfully migrated all restaurants from the live URL to Supabase!');
    }

  } catch (error) {
    console.error('❌ Failed to fetch or process the live URL:', error);
  }
}

migrateDataFromUrl();