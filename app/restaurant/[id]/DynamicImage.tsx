'use client';

import { useState, useEffect } from 'react';

export default function DynamicImage({ imageUrl, title }: { imageUrl?: string | null, title: string }) {
  const defaultImage = '/images/default.jpg';
  
  // Start with the Supabase image if it exists, otherwise use default
  const [imgSrc, setImgSrc] = useState(imageUrl || defaultImage);

  // If the database data loads a split-second late, this catches it and updates the image
  useEffect(() => {
    setImgSrc(imageUrl || defaultImage);
  }, [imageUrl]);

  return (
    <img 
      src={imgSrc} 
      alt={title} 
      onError={() => setImgSrc(defaultImage)} // If the Supabase link is broken, fall back instantly
      className="object-cover w-full h-full opacity-60 absolute inset-0 z-0 transition-opacity duration-300" 
    />
  );
}