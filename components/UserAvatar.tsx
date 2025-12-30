'use client';

import { useState } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';

interface UserAvatarProps {
  name?: string | null;
  image?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function UserAvatar({ name, image, size = 'md', className = '' }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  const sizes = {
    xs: { container: 'w-4 h-4', text: 'text-[10px]', icon: 'w-2 h-2' },
    sm: { container: 'w-6 h-6', text: 'text-xs', icon: 'w-3 h-3' },
    md: { container: 'w-8 h-8', text: 'text-sm', icon: 'w-4 h-4' },
    lg: { container: 'w-10 h-10', text: 'text-base', icon: 'w-5 h-5' },
    xl: { container: 'w-12 h-12', text: 'text-lg', icon: 'w-6 h-6' },
  };

  const currentSize = sizes[size];

  const getUserInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  // Show image if provided and no error occurred
  if (image && image.trim() !== '' && !imageError) {
    // Use regular img tag for data URLs, Next.js Image for regular URLs
    const isDataUrl = image.startsWith('data:');
    
    return (
      <div className={`relative ${currentSize.container} rounded-full overflow-hidden border-2 border-primary/20 ${className}`}>
        {isDataUrl ? (
          <img
            src={image}
            alt={name || 'User'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Image
            src={image}
            alt={name || 'User'}
            fill
            className="object-cover"
            sizes={currentSize.container}
            unoptimized
            onError={() => setImageError(true)}
          />
        )}
      </div>
    );
  }

  // Fallback to initials
  return (
    <div className={`${currentSize.container} rounded-full bg-[#0101b7] flex items-center justify-center  ${className}`}>
      {name ? (
        <span className={`${currentSize.text} font-primary font-semibold text-white`}>
          {getUserInitials(name)}
        </span>
      ) : (
        <User className={`${currentSize.icon} text-primary`} />
      )}
    </div>
  );
}

