import React from 'react';
import Svg, { Circle, Ellipse, Path, Line, G } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

interface RabbitFoodLogoProps {
  size?: number;
}

export const RabbitFoodLogo: React.FC<RabbitFoodLogoProps> = ({ size = 200 }) => {
  const { theme, isDark } = useTheme();
  
  // Colors adapt to theme
  const bgOuter = isDark ? '#2D2620' : '#F5F1EB';
  const bgInner = isDark ? '#1A1612' : '#FFFCF7';
  const primary = '#E8B4A8';
  const primaryLight = '#F5D5CC';
  const primaryDark = '#D4A89C';
  const textColor = isDark ? '#F5F1EB' : '#3D3226';
  const accentGreen = isDark ? '#7BC47B' : '#6BAF6B';
  const accentOrange = '#E8A84E';
  const accentRed = '#D84A4A';
  
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {/* Background Circle */}
      <Circle cx="100" cy="100" r="95" fill={bgOuter}/>
      <Circle cx="100" cy="100" r="85" fill={bgInner}/>
      
      {/* Rabbit Head */}
      <Ellipse cx="100" cy="110" rx="35" ry="40" fill={primary}/>
      
      {/* Left Ear */}
      <G rotation="-15" origin="85, 65">
        <Ellipse cx="85" cy="65" rx="12" ry="35" fill={primary}/>
        <Ellipse cx="85" cy="65" rx="7" ry="28" fill={primaryLight}/>
      </G>
      
      {/* Right Ear */}
      <G rotation="15" origin="115, 65">
        <Ellipse cx="115" cy="65" rx="12" ry="35" fill={primary}/>
        <Ellipse cx="115" cy="65" rx="7" ry="28" fill={primaryLight}/>
      </G>
      
      {/* Eyes */}
      <Circle cx="90" cy="105" r="4" fill={textColor}/>
      <Circle cx="110" cy="105" r="4" fill={textColor}/>
      <Circle cx="91" cy="104" r="1.5" fill={bgInner}/>
      <Circle cx="111" cy="104" r="1.5" fill={bgInner}/>
      
      {/* Nose */}
      <Ellipse cx="100" cy="115" rx="3" ry="4" fill={primaryDark}/>
      
      {/* Mouth */}
      <Path d="M 100 115 Q 95 120 92 118" stroke={textColor} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <Path d="M 100 115 Q 105 120 108 118" stroke={textColor} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      
      {/* Whiskers Left */}
      <Line x1="70" y1="110" x2="85" y2="108" stroke={textColor} strokeWidth="1" strokeLinecap="round"/>
      <Line x1="70" y1="115" x2="85" y2="115" stroke={textColor} strokeWidth="1" strokeLinecap="round"/>
      
      {/* Whiskers Right */}
      <Line x1="130" y1="110" x2="115" y2="108" stroke={textColor} strokeWidth="1" strokeLinecap="round"/>
      <Line x1="130" y1="115" x2="115" y2="115" stroke={textColor} strokeWidth="1" strokeLinecap="round"/>
      
      {/* Food Bowl */}
      <Path d="M 70 145 L 75 165 L 125 165 L 130 145 Z" fill={primaryLight} stroke={primaryDark} strokeWidth="2"/>
      <Ellipse cx="100" cy="145" rx="30" ry="8" fill={primary}/>
      
      {/* Food Items in Bowl */}
      {/* Carrot */}
      <Path d="M 85 150 L 82 160 L 88 160 Z" fill={accentOrange}/>
      <Line x1="85" y1="150" x2="85" y2="147" stroke={accentGreen} strokeWidth="2" strokeLinecap="round"/>
      
      {/* Lettuce */}
      <Circle cx="100" cy="155" r="5" fill={accentGreen} opacity="0.8"/>
      <Circle cx="103" cy="153" r="4" fill={accentGreen} opacity="0.9"/>
      
      {/* Tomato */}
      <Circle cx="115" cy="155" r="4" fill={accentRed}/>
      <Path d="M 115 152 L 113 150 L 117 150 Z" fill={accentGreen}/>
      
      {/* Delivery Badge */}
      <Circle cx="145" cy="75" r="22" fill={primary}/>
      <Circle cx="145" cy="75" r="18" fill={bgInner}/>
      
      {/* Delivery Icon (Fast Forward) */}
      <Path d="M 138 75 L 145 70 L 145 80 Z" fill={primary}/>
      <Path d="M 145 75 L 152 70 L 152 80 Z" fill={primary}/>
      
      {/* Speed Lines */}
      <Line x1="132" y1="70" x2="136" y2="70" stroke={primaryDark} strokeWidth="1.5" strokeLinecap="round"/>
      <Line x1="132" y1="75" x2="136" y2="75" stroke={primaryDark} strokeWidth="1.5" strokeLinecap="round"/>
      <Line x1="132" y1="80" x2="136" y2="80" stroke={primaryDark} strokeWidth="1.5" strokeLinecap="round"/>
      
      {/* Chef Hat Badge */}
      <Circle cx="55" cy="75" r="22" fill={primary}/>
      <Circle cx="55" cy="75" r="18" fill={bgInner}/>
      
      {/* Chef Hat */}
      <Ellipse cx="55" cy="78" rx="8" ry="3" fill={primary}/>
      <Path d="M 47 78 Q 47 68 55 68 Q 63 68 63 78 Z" fill={primary}/>
      <Ellipse cx="55" cy="68" rx="4" ry="4" fill={primaryLight}/>
    </Svg>
  );
};
