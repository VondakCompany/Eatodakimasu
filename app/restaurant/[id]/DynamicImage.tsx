'use client';

import { useState } from 'react';

export default function DynamicImage({ title }: { title: string }) {
  const [imgSrc, setImgSrc] = useState(`/images/${title}.jpg`);

  return (
    <img 
      src={imgSrc} 
      alt={title} 
      onError={() => setImgSrc('/images/default.jpg')}
      className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity absolute inset-0 z-0" 
    />
  );
}