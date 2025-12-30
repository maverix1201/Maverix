import Image from 'next/image';

interface LogoWhiteProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LogoWhite({ className = '', size = 'md' }: LogoWhiteProps) {
  const sizes = {
    sm: { width: 100, height: 35 },
    md: { width: 120, height: 40 },
    lg: { width: 150, height: 50 },
  };

  const currentSize = sizes[size];

  return (
    <Image
      src="/assets/maverix-whitelogo.png"
      alt="MaveriX Logo"
      width={currentSize.width}
      height={currentSize.height}
      className={`object-contain ${className}`}
      priority
      unoptimized
    />
  );
}
