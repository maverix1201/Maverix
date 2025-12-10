'use client';

interface CircleProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function CircleProgress({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  className = '',
}: CircleProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    const percent = (value / max) * 100;
    if (percent >= 70) return '#10b981'; // green
    if (percent >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-primary font-bold text-gray-800 leading-none">
          {value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}
        </span>
        <span className="text-xs font-secondary text-gray-500 mt-0.5">of {max}</span>
      </div>
    </div>
  );
}


