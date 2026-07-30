import React from 'react';
import { useNavigate } from 'react-router-dom';
import BrandNavbar from './BrandNavbar';
import HeroSection from './HeroSection';
import ValueCards from './ValueCards';
import ScenarioCarousel from './ScenarioCarousel';
import ExperienceEntry from './ExperienceEntry';
import XiaLiaSection from './XiaLiaSection';
import AIChatCenter from '../Home/components/AIChatCenter';

export default function BrandHome() {
  const navigate = useNavigate();

  const handleCTAClick = () => {
    navigate('/execution-center');
  };

  return (
    <div style={{ background: '#FAFBFC', minHeight: '100vh' }}>
      <BrandNavbar />
      <HeroSection onCTAClick={handleCTAClick} />
      <ValueCards />
      <ScenarioCarousel />
      <ExperienceEntry onEnter={handleCTAClick} />
      <XiaLiaSection />
      <AIChatCenter />
    </div>
  );
}
